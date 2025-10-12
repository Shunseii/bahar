import { config } from "../utils/config";
import { CreateEmailOptions, Resend } from "resend";

const resend = new Resend(config.RESEND_API_KEY);

export const sendMail = async (msg: CreateEmailOptions) => {
  return resend.emails.send(msg);
};
