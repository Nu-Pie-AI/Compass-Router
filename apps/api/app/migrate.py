from pathlib import Path

from alembic import command
from alembic.config import Config


def upgrade_to_head() -> None:
    root = Path(__file__).resolve().parent.parent
    config = Config(str(root / "alembic.ini"))
    config.set_main_option("script_location", str(root / "alembic"))
    command.upgrade(config, "head")


if __name__ == "__main__":
    upgrade_to_head()
