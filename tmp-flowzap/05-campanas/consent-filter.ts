export type CampaignContact = {
  id?: string;
  phone: string;
  tags?: string[];
  opt_in?: boolean | null;
  opt_out?: boolean | null;
  blocked?: boolean | null;
  no_contact?: boolean | null;
};

export function isCampaignEligible(contact: CampaignContact) {
  if (!contact.phone) return false;
  if (contact.blocked || contact.no_contact || contact.opt_out) return false;
  return contact.opt_in !== false;
}

export function filterEligibleContacts<T extends CampaignContact>(contacts: T[]) {
  const seen = new Set<string>();
  return contacts.filter(contact => {
    if (!isCampaignEligible(contact)) return false;
    const phone = contact.phone.replace(/[^\d]/g, '');
    if (!phone || seen.has(phone)) return false;
    seen.add(phone);
    return true;
  });
}
