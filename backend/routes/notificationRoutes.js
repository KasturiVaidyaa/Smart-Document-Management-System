import express from "express";
import { isAuth } from "../middlewares/isAuth.js";
import {
  listNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "../controllers/notificationController.js";

const router = express.Router();

router.use(isAuth);

router.get("/", listNotifications);
router.patch("/:id/read", markNotificationAsRead);
router.post("/read-all", markAllNotificationsAsRead);

export default router;
