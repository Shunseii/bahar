import { type CreateEmailOptions, Resend } from "resend";
import { config } from "../utils/config";

const resend = new Resend(config.RESEND_API_KEY);

export const sendMail = async (msg: CreateEmailOptions) => {
  return resend.emails.send(msg);
};
