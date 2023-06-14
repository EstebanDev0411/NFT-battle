import { Router } from "express";
import leaderboard from "../controller/leaderboard.controller";
import { verifyBodyRequest } from "../middlewares/verifyRequest";

const leaderboardRoute = Router();

// matchRoute.post("/create", verifyBodyRequest, match.addMatch);
leaderboardRoute.get("/getDailyRanks", leaderboard.getDailyRanks);
leaderboardRoute.get("/getWeeklyRanks", leaderboard.getWeeklyRanks);
leaderboardRoute.post('/getDailyAward', verifyBodyRequest, leaderboard.getDailyAward);
leaderboardRoute.post('/getWeeklyAward', verifyBodyRequest, leaderboard.getWeeklyAward);

export default leaderboardRoute;
