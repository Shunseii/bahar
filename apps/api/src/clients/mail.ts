import sgMail from "@sendgrid/mail";
import { config } from "../config";

sgMail.setApiKey(config.SENDGRID_API_KEY!);

export const sendMail = async (
  msg: sgMail.MailDataRequired | sgMail.MailDataRequired[],
) => {
  return sgMail.send(msg);
};
