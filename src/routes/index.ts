import authRoute from "./auth.route";
import userRoute from "./user.route";
import matchRoute from "./match.route";
import leaderboardRoute from "./leaderboard.route";

export default function setupRoute(app: any) {
  app.use("/auth", authRoute);
  app.use("/user", userRoute);
  app.use("/match", matchRoute);
  app.use("/leaderboard", leaderboardRoute);
}
