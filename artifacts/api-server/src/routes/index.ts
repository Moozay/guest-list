import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import invitesRouter from "./invites";
import usersRouter from "./users";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(invitesRouter);

export default router;
