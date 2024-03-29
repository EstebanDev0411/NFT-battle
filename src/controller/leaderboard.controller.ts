import { RequestHandler } from "express";
import { StatusCodes } from "http-status-codes";
import logger from "../utils/logger";
import { userCollection, leaderboardCollection } from "../config/collections";
import { getFirestore } from "firebase-admin/firestore";
import * as admin from 'firebase-admin';
import { ethers } from "ethers";
import { candyTokenABI } from "../utils/candyTokenAbi"

const adminPrivateKey = 'fbee3586ad39698b8b5639e60b90d926cd23ffe16887766ae804ea0cbb592eaa';
// Set up provider and signer
const provider = new ethers.JsonRpcProvider("https://evm.cronos.org");
const signer = new ethers.Wallet(adminPrivateKey, provider);

// Set up Candy Token contract
// const adminAddress = '0x0e8F349464e19749B7F3b86f4f0593F15E5cC53a';
const candyTokenAddress = "0x06C04B0AD236e7Ca3B3189b1d049FE80109C7977";
const candyTokenContract = new ethers.Contract(candyTokenAddress, candyTokenABI, signer);


const db = getFirestore();
interface User {
  id: string;
  userName: string;
  dailyScore: number;
  weeklyScore: number;
  lastPlayed: admin.firestore.Timestamp;
}

interface AwardUser {
  reward: boolean;
  name: string;
  id: string;
  dailyScore: number;
}

// Get daily ranks
export const getDailyRanks : RequestHandler = async (req: any, res: any) => {
  logger.info("Get daily ranks");
  try {
    const { count, page, userId } = req.query;
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
    const myRank = dailyRanks.find((data) => data.user.userName === userId);
    const paginatedRanks = dailyRanks.slice(startAfter, endBefore);
    
    const rewardUsersQuery = await db.collection(leaderboardCollection).doc("dailyReward").get();
    const rewardUsers = rewardUsersQuery.data();
    if (rewardUsers && Object.keys(rewardUsers).length > 0) 
    {
      const userIndex = rewardUsers?.users.findIndex((user: { name: any; }) => user.name === userId);
      if (userIndex !== -1) {
        const awardStatus = rewardUsers?.users[userIndex]?.reward;
        console.log(userIndex)
        const award = {
          "awardStatus" : awardStatus,
          "rank" : userIndex + 1
        }
        console.log("awardStatus", award)
        return res.status(StatusCodes.OK).json({award, myRank, paginatedRanks});
      }   
    }
    // Paginate results
    return res.status(StatusCodes.OK).json({myRank, paginatedRanks});
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(error);
  }
};

//Get weekly ranks
export const getWeeklyRanks : RequestHandler = async (req: any, res: any) => {
  logger.info("Get weekly ranks");
  try {
    const { count, page, userId } = req.query;
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
    console.log(weeklyRanks)
    const myRank = weeklyRanks.find((data) => data.user.userName === userId);
    // Paginate results
    const paginatedRanks = weeklyRanks.slice(startAfter, endBefore);
    const rewardUsersQuery = await db.collection(leaderboardCollection).doc("weeklyReward").get();
    const rewardUsers = rewardUsersQuery.data();
    if (rewardUsers && Object.keys(rewardUsers).length > 0) 
    {
      const userIndex = rewardUsers?.users.findIndex((user: { name: any; }) => user.name === userId);
      if (userIndex !== -1) {
        const awardStatus = rewardUsers?.users[userIndex]?.reward;
        const award = {
          "awardStatus" : awardStatus,
          "rank" : userIndex + 1
        }
        console.log("awardStatus", award)
        return res.status(StatusCodes.OK).json({award, myRank, paginatedRanks});
      }   
    }
    // Paginate results
    return res.status(StatusCodes.OK).json({myRank, paginatedRanks});
    
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(error);
  }
};

// Set up transfer function
async function transferCandyToken(to: string, value: ethers.BigNumberish): Promise<ethers.TransactionReceipt> {
  const tx = await candyTokenContract.transfer(to, value);
  console.log("Transaction hash:", tx.hash);
  const receipt = await tx.wait();
  console.log("Transaction confirmed.");
  return receipt;
}

// Give Award
export const getDailyAward: RequestHandler = async (req, res) => {
  logger.info("Get Award");
  const { userId } = req.query; 
  try {
    const { rewardAmount, walletAddress } = req.body;
    // Example usage
    const value = ethers.parseUnits(rewardAmount, 18); // Transfer 100 Candy Tokens
    const receipt = await transferCandyToken(walletAddress, value);
    if (receipt.status === 1) {
      // Update database with successful transaction
      const rewardUsers = (await db.collection(leaderboardCollection).doc("dailyReward").get()).data();
      console.log(rewardUsers)
      const updatedUsers = rewardUsers?.users.map((user : AwardUser) => {
        if (user.name === userId) {
          return { ...user, reward: false };
        } else {
          return user;
        }
      });
      await db.collection(leaderboardCollection).doc("dailyReward").set({users: updatedUsers});
      return res.status(200).json({ message: 'Award sent successfully' });
    } else {
      return res.status(500).json({ message: 'Transaction failed' });
    }
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(error);
  }
};

// Give Weekly Award
export const getWeeklyAward: RequestHandler = async (req, res) => {
  logger.info("Get Award");
  const { userId } = req.query; 
  try {
    const { rewardAmount, walletAddress } = req.body;
    // Example usage
    const value = ethers.parseUnits(rewardAmount, 18); // Transfer 100 Candy Tokens
    const receipt = await transferCandyToken(walletAddress, value);
    if (receipt.status === 1) {
      // Update database with successful transaction
      const rewardUsers = (await db.collection(leaderboardCollection).doc("weeklyReward").get()).data();
      console.log(rewardUsers)
      const updatedUsers = rewardUsers?.users.map((user : AwardUser) => {
        if (user.name === userId) {
          return { ...user, reward: false };
        } else {
          return user;
        }
      });
      await db.collection(leaderboardCollection).doc("weeklyReward").set({users: updatedUsers});
      return res.status(200).json({ message: 'Award sent successfully' });
    } else {
      return res.status(500).json({ message: 'Transaction failed' });
    }
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(error);
  }
};

// Give Monthly Award
export const getMonthlyReward: RequestHandler = async (req, res) => {
  logger.info("Get Monthly Award");
  const { userId } = req.query; 
  try {
    const { rewardAmount, walletAddress } = req.body;
    // Example usage
    const value = ethers.parseUnits(rewardAmount, 18); // Transfer 100 Candy Tokens
    const receipt = await transferCandyToken(walletAddress, value);
    if (receipt.status === 1) {
      // Update database with successful transaction
      const rewardUsers = (await db.collection(leaderboardCollection).doc("monthlyReward").get()).data();
      console.log(rewardUsers)
      const updatedUsers = rewardUsers?.users.map((user : AwardUser) => {
        if (user.name === userId) {
          return { ...user, reward: false };
        } else {
          return user;
        }
      });
      await db.collection(leaderboardCollection).doc("monthlyReward").set({users: updatedUsers});
      return res.status(200).json({ message: 'Award sent successfully' });
    } else {
      return res.status(500).json({ message: 'Transaction failed' });
    }
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

// Define a function to update the daily leaderboard
async function updateDailyLeaderboards() {
  console.log('update daily leaderboards!')
  const usersRef = db.collection(userCollection);
  const leaderboardRef = db.collection(leaderboardCollection);

  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  // const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());

  // Get the top 3 daily users and update the daily top 3 collection
  const yesterdayQuery = await usersRef.where('lastPlayed', '>=', yesterday).get();
  const yesterdayUsers = yesterdayQuery.docs.map(doc => ({ id: doc.id, name: doc.data().userName, dailyScore: doc.data().dailyScore, reward: true }));
  // Sort the users by daily score and get the top 3
  const top3Users = yesterdayUsers
    .filter(user => user.dailyScore > 0) // Exclude users with a daily score of 0
    .sort((a, b) => b.dailyScore - a.dailyScore)
    .slice(0, 3);
  console.log(top3Users)
  await leaderboardRef.doc("dailyReward").set({users: top3Users});
}

// Define a function to update the weekly leaderboard
async function updateWeeklyLeaderboards() {
  console.log('update weekly leaderboards!')
  const usersRef = db.collection(userCollection);
  const leaderboardRef = db.collection(leaderboardCollection);

  const today = new Date();
  // const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());
  const lastWeekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay() - 7);

  // Get the top 3 weekly users and update the weekly top 3 collection
  const weeklyQuery = await usersRef.where('lastPlayed', '>=', lastWeekStart).get();
  const weeklyUsers = weeklyQuery.docs.map(doc => ({ id: doc.id, name: doc.data().userName, weeklyScore: doc.data().weeklyScore, reward: true }));
  const top3WeeklyUsers = weeklyUsers
    .filter(user => user.weeklyScore > 0) // Exclude users with a weekly score of 0
    .sort((a, b) => b.weeklyScore - a.weeklyScore)
    .slice(0, 3);
  console.log(top3WeeklyUsers)
  await leaderboardRef.doc("weeklyReward").set({users: top3WeeklyUsers});
}

async function updateMonthlyLeaderboards() {
  console.log('Updating monthly leaderboards!');
  const leaderboardRef = db.collection(leaderboardCollection);
  const monthlyRanking = leaderboardRef.doc('monthlyRanking');
  const monthlyReward = leaderboardRef.doc('monthlyReward');

  // Get the current top users in the monthly ranking
  const leaderboardDoc = await monthlyRanking.get();
  const currentTopUsers = leaderboardDoc.exists ? leaderboardDoc.data()?.topUsers ?? [] : [];
  // Sort the top users by score in descending order
  const sortedTopUsers = currentTopUsers.sort((a: { score: number; }, b: { score: number; }) => b.score - a.score);

  // Extract the top 3 users and their scores
  const top3Users = sortedTopUsers.slice(0, 3).map((user: { score: any; userId: any; }, index: number) => ({ score: user.score, rank: index + 1, name: user.userId, award: true}));

  // Store the top 3 users in the monthly reward document
  await monthlyReward.set({ topUsers: top3Users });

  // Clear the data in the monthly ranking document
  await monthlyRanking.set({ topUsers: [] });
}

// Define a function to reset the daily and weekly scores
// async function resetScores() {
//   const usersRef = db.collection('users');
//   const today = new Date();
//   const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());

//   // Reset daily scores
//   const dailyResetQuery = usersRef.where('lastPlayed', '<=', today.toISOString()).get();
//   (await dailyResetQuery).docs.forEach(doc => doc.ref.update({ dailyScore: 0 }));

//   // Reset weekly scores
//   const weeklyResetQuery = usersRef.where('lastPlayed', '<=', weekStart.toISOString()).get();
//   (await weeklyResetQuery).docs.forEach(doc => doc.ref.update({ weeklyScore: 0 }));
// }

// Call the updateLeaderboards function once a day at midnight
setInterval(() => {
  const now = new Date();
    if (now.getHours() === 0 && now.getMinutes() === 0) {
      updateDailyLeaderboards();
        // resetScores();
    }
    if (now.getDay() === 1 && now.getHours() === 0 && now.getMinutes() === 0)
    {
      updateWeeklyLeaderboards();
    }
    if (now.getDate() === 1 && now.getHours() === 0 && now.getMinutes() === 0) {
      updateMonthlyLeaderboards();
    }
  }, 60000);

const leaderboard = { getDailyRanks, getWeeklyRanks, getDailyAward, getWeeklyAward, getMonthlyReward };
export default leaderboard;