import { RequestHandler } from "express";
import { StatusCodes } from "http-status-codes";
import logger from "../utils/logger";
import { userCollection } from "../config/collections";
import { getFirestore } from "firebase-admin/firestore";
import * as admin from 'firebase-admin';

const db = getFirestore();
interface User {
  id: string;
  userName: string;
  dailyScore: number;
  weeklyScore: number;
  lastPlayed: admin.firestore.Timestamp;
}

// Get daily ranks
export const getDailyRanks : RequestHandler = async (req: any, res: any) => {
  logger.info("Get daily ranks");
  try {
    const { count, page } = req.query;
    const startAfter = count * (page - 1);
    const endBefore = startAfter + count;

    // Get all users' scores from Firestore
    const snapshot = await db.collection(userCollection).get();
    const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));

    // Sort users by daily score (descending)
    users.sort((a, b) => b.dailyScore - a.dailyScore);

    // Calculate daily ranks
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayUsers = users.filter(user => user.dailyScore > 0 && user.lastPlayed.toDate() >= todayStart);
    const dailyRanks = todayUsers.map((user, index) => ({ user, rank: index + 1 }));

    // Paginate results
    const paginatedRanks = dailyRanks.slice(startAfter, endBefore);
    return res.status(StatusCodes.OK).json(paginatedRanks);

  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(error);
  }
};

//Get weekly ranks
export const getWeeklyRanks : RequestHandler = async (req: any, res: any) => {
  logger.info("Get weekly ranks");
  try {
    const { count, page } = req.query;
    const startAfter = count * (page - 1);
    const endBefore = startAfter + count;

    // Get all users' scores from Firestore
    const snapshot = await db.collection(userCollection).get();
    const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));

    // Sort users by daily score (descending)
    users.sort((a, b) => b.weeklyScore - a.weeklyScore);

    // Calculate daily ranks
    const today = new Date();
    const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());
    const weekUsers = users.filter(user => user.weeklyScore > 0 && user.lastPlayed.toDate() >= weekStart);
    const weeklyRanks = weekUsers.map((user, index) => ({ user, rank: index + 1 }));

    // Paginate results
    const paginatedRanks = weeklyRanks.slice(startAfter, endBefore);
    return res.status(StatusCodes.OK).json(paginatedRanks);
    
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(error);
  }
};

// export const resetDailyScore = functions.pubsub.schedule('every 24 hours').onRun(async (context) => {
//   const collection = db.collection(dailyScoreCollection);
//   const querySnapshot = await db.collection(dailyScoreCollection).get();
//   querySnapshot.forEach((doc) => {
//     doc.ref.update({
//       point: 0,
//       lastPlayed: ''
//     })
//     .then(() => {
//       console.log(`Document ${doc.id} updated successfully`);
//     })
//     .catch((error) => {
//       console.error(`Error updating document ${doc.id}:`, error);
//     });
//   });
//   console.log('Daily report generated and stored in Firestore successfully');
// });

// export const resetWeeklyScore = functions.pubsub.schedule('every monday 00:00').onRun(async (context) => {
//   const collection = db.collection(weeklyScoreCollection);
//   const querySnapshot = await db.collection(userCollection).orderBy('points', 'desc').get();
//   const report = querySnapshot.docs.map((doc) => {
//     return {
//       userId: doc.id,
//       points: doc.data().points,
//       rank: doc.data().rank,
//       timestamp: admin.firestore.Timestamp.now(),
//     };
//   });
//   const reportId = `weekly_${context.timestamp}`;
//   await collection.doc(reportId).set({  : report });
//   console.log('Weekly report generated and stored in Firestore successfully');
// });

const leaderboard = { getDailyRanks, getWeeklyRanks };
export default leaderboard;