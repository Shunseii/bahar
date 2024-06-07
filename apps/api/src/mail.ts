import sgMail from "@sendgrid/mail";

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

export const sendMail = async (
  msg: sgMail.MailDataRequired | sgMail.MailDataRequired[],
) => {
  return sgMail.send(msg);
};
