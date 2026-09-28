type PartnerAccess = {
  approvalStatus: string;
  status: string;
};

export function isApprovedPartner(partner: PartnerAccess | null | undefined) {
  return partner?.approvalStatus === "APPROVED" && partner.status === "approved";
}

export function partnerApprovalError() {
  return "Partner account must be approved before accessing this feature";
}
