import authRoute from "./auth.route";
import userRoute from "./user.route";
import leaderboardRoute from "./leaderboard.route";

export default function setupRoute(app: any) {
  app.use("/auth", authRoute);
  app.use("/user", userRoute);
  app.use("/leaderboard", leaderboardRoute);
}
