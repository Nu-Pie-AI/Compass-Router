from sqlalchemy import and_, exists, func, or_, select
from sqlalchemy.orm import Session

from .errors import compass_error
from .models import Organization, OrganizationMember, Project, ProjectMember, Team, TeamMember, User


def is_admin(user: User) -> bool:
    return user.role in {"admin", "super_admin"}


def _active_organization_membership(db: Session, user: User, organization_id: str):
    return exists(
        select(OrganizationMember.id).where(
            OrganizationMember.organization_id == organization_id,
            OrganizationMember.user_id == user.id,
            OrganizationMember.role != "removed",
        )
    )


def team_ids_for_user(db: Session, user: User) -> list[str]:
    if is_admin(user):
        return list(db.scalars(select(Team.id).where(Team.is_active.is_(True))).all())
    member_match = or_(
        TeamMember.user_id == user.id,
        and_(TeamMember.user_id.is_(None), func.lower(TeamMember.email) == user.email.lower()),
    )
    return list(
        db.scalars(
            select(Team.id)
            .join(TeamMember, TeamMember.team_id == Team.id)
            .where(
                member_match,
                TeamMember.is_active.is_(True),
                Team.is_active.is_(True),
                or_(Team.organization_id.is_(None), _active_organization_membership(db, user, Team.organization_id)),
            )
        ).all()
    )


def team_owner_ids_for_user(db: Session, user: User) -> list[str]:
    if is_admin(user):
        return list(db.scalars(select(Team.id).where(Team.is_active.is_(True))).all())
    member_match = or_(
        TeamMember.user_id == user.id,
        and_(TeamMember.user_id.is_(None), func.lower(TeamMember.email) == user.email.lower()),
    )
    return list(
        db.scalars(
            select(Team.id)
            .join(TeamMember, TeamMember.team_id == Team.id)
            .where(
                member_match,
                TeamMember.is_active.is_(True),
                TeamMember.role.in_(["owner", "admin"]),
                Team.is_active.is_(True),
                or_(Team.organization_id.is_(None), _active_organization_membership(db, user, Team.organization_id)),
            )
        ).all()
    )


def workspace_ids_for_user(db: Session, user: User) -> list[str]:
    if is_admin(user):
        return list(db.scalars(select(Organization.id)).all())
    return list(
        db.scalars(
            select(OrganizationMember.organization_id).where(
                OrganizationMember.user_id == user.id,
                OrganizationMember.role != "removed",
            )
        ).all()
    )


def require_workspace_access(db: Session, user: User, workspace_id: str) -> None:
    if workspace_id not in workspace_ids_for_user(db, user):
        raise compass_error(403, "workspace_access_denied", "You do not have access to this workspace.")


def require_team_access(db: Session, user: User, team_id: str) -> None:
    if team_id not in team_ids_for_user(db, user):
        raise compass_error(403, "team_access_denied", "You do not have access to this team.")


def require_team_owner(db: Session, user: User, team_id: str) -> None:
    if team_id not in team_owner_ids_for_user(db, user):
        raise compass_error(403, "team_owner_required", "A team owner or administrator is required.")


def require_project_access(db: Session, user: User, project_id: str, write: bool = False) -> Project:
    project = db.get(Project, project_id)
    if project is None or not project.is_active:
        raise compass_error(404, "project_not_found", "Project not found.")
    if is_admin(user):
        return project
    membership = db.scalar(
        select(ProjectMember)
        .join(OrganizationMember, OrganizationMember.user_id == ProjectMember.user_id)
        .where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user.id,
            ProjectMember.status == "active",
            OrganizationMember.organization_id == project.organization_id,
            OrganizationMember.role != "removed",
        )
    )
    if membership is None or (write and membership.role not in {"owner", "admin"}):
        raise compass_error(403, "project_access_denied", "You do not have access to this project.")
    return project
