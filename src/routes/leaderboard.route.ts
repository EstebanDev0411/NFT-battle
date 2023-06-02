import { Router } from "express";
import leaderboard from "../controller/leaderboard.controller";

const leaderboardRoute = Router();

// matchRoute.post("/create", verifyBodyRequest, match.addMatch);
leaderboardRoute.get("/getDailyRanks", leaderboard.getDailyRanks);
leaderboardRoute.get("/getWeeklyRanks", leaderboard.getWeeklyRanks);
export default leaderboardRoute;
