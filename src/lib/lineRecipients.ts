export const DEFAULT_LINE_GROUP_ID = "Cb126126f5369ab6272ba2775e35c0641";

export const appendDefaultLineGroupRecipients = (recipients: string[]) => {
  const uniqueRecipients = Array.from(new Set((recipients || []).filter(Boolean)));
  if (!uniqueRecipients.includes(DEFAULT_LINE_GROUP_ID)) {
    uniqueRecipients.push(DEFAULT_LINE_GROUP_ID);
  }
  return uniqueRecipients;
};
