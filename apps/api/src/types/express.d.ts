import { Session, User } from "lucia";

declare global {
  namespace Express {
    interface Request {
      user: User;
      session: Session;
    }
  }
}
