import { RequestHandler } from "express";
import { StatusCodes } from "http-status-codes";
import logger from "../utils/logger";
import { userCollection, leaderboardCollection } from "../config/collections";
import FirestoreService from "../service/firestore.service";
import { getFirestore } from "firebase-admin/firestore";
import * as admin from 'firebase-admin';

const db = getFirestore();

// Define types
interface User {
  id: string;
  name: string;
  dailyScore: number;
  weeklyScore: number;
  lastPlayed: admin.firestore.Timestamp;
}

export const deleteUser: RequestHandler = (req: any, res: any) => {
  logger.info("delete user");
  const userId = req.query.userId;
  FirestoreService.deleteOne(userCollection, userId)
    .then((_response) => {
      return res
        .status(StatusCodes.OK)
        .json({ status: "successfully deleted" });
    })
    .catch((error: any) => {
      return res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .json({ error: error.message });
    });
};

export const updateUser: RequestHandler = (req: any, res: any) => {
  logger.info("update user");
  const userId = req.query.userId;
  FirestoreService.updateOne(userCollection, userId, req.body)
    .then((_response) => {
      return res
        .status(StatusCodes.OK)
        .json({ status: "successfully updated" });
    })
    .catch((error: any) => {
      return res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .json({ error: error.message });
    });
};

export const getUser: RequestHandler = async (req: any, res: any) => {
  logger.info("get user");
  const userId = req.query.userId;
  try
  {
    const ret = (await db.collection(userCollection).doc(userId).get()).data();
    return res.status(StatusCodes.OK).json(ret);
  } catch(error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(error);
  }
};

export const postScore: RequestHandler = async (req: any, res: any) => {
  logger.info("post Score");
  try
  {
    const userId = req.query.userId;
    const { score } = req.body;
    const userRef = db.collection(userCollection).where('userName', '==', userId).get();
    const userDoc = (await userRef).docs[0];
    if (!userDoc.exists) {
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json("That user does not exist!");
    }
    const user = userDoc.data() as User;
    // Update daily and weekly scores based on current date
    const today = new Date();
    const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());
    if (user.lastPlayed.toDate().getFullYear() !== today.getFullYear() ||
        user.lastPlayed.toDate().getMonth() !== today.getMonth() ||
        user.lastPlayed.toDate().getDate() !== today.getDate()) {
      // Reset daily score if it's a new day
      await userDoc.ref.update({ dailyScore: parseInt(score), lastPlayed: admin.firestore.Timestamp.fromDate(today) });
    }
    else if (parseInt(score) >= user.dailyScore) {
      // Update daily score if it's higher than the current one
      await userDoc.ref.update({ dailyScore: parseInt(score), lastPlayed: admin.firestore.Timestamp.fromDate(today)});
    }
    if (user.lastPlayed.toDate() < weekStart) {
      // Reset weekly score if it's a new week
      await userDoc.ref.update({ weeklyScore: parseInt(score) });
    }

    if (parseInt(score) >= user.weeklyScore) {
      // Update weekly score if it's higher than the current one
      await userDoc.ref.update({ weeklyScore: parseInt(score) });
    }
    const leaderboardRef = db.collection(leaderboardCollection).doc('monthlyRanking');
    const leaderboardDoc = await leaderboardRef.get();
    const currentTopUsers = leaderboardDoc.exists ? leaderboardDoc.data()?.topUsers ?? [] : [];
    const existingUserIndex = currentTopUsers.findIndex((user: { userId: any; }) => user.userId === userId);
    if (existingUserIndex >= 0) {
      // Update existing user's score
      currentTopUsers[existingUserIndex].score = Math.max(currentTopUsers[existingUserIndex].score, parseInt(score));
    } else {
      // Add new user to top users list
      const topScore = parseInt(score);
      currentTopUsers.push({ userId, topScore });
    }
    
    // Sort and limit top users list
    const newTopUsers = currentTopUsers
      .sort((a: { score: number; }, b: { score: number; }) => b.score - a.score)
      .slice(0, 3);
    await leaderboardRef.set({ topUsers: newTopUsers });
    return res.status(StatusCodes.OK).json("updated successfully");
  } catch(error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(error);
  }
};

export const upgradeLevel: RequestHandler = async (req: any, res: any) => {
  logger.info("Update the ability of user");
  try {
    const userId = req.query.userId;
    const { stamina, damage, reloadspeed } = req.body;
    const updates: Record<string, unknown> = {};
    if (stamina != null && parseInt(stamina) <= 6 && parseInt(stamina) > 1) {
      updates.stamina = parseInt(stamina);
    }

    if (damage != null && parseInt(damage) <= 6 && parseInt(damage) > 1) {
      updates.damage = parseInt(damage);
    }

    if (reloadspeed != null && reloadspeed <= 6 && reloadspeed > 1) {
      updates.reloadspeed = parseInt(reloadspeed);
    }
    await (await db.collection(userCollection).where('userName', '==', userId).get()).docs[0].ref.update(updates)
    .then((_response) => {
      return res
        .status(StatusCodes.OK)
        .json({ status: "successfully updated" });
    })
    .catch((error: any) => {
      return res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .json({ error: error.message });
    });
  } catch(error)
  {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(error);
  }
}

export const addBalance: RequestHandler = async (req: any, res: any) => {
  logger.info("Add balance");
  try {
    const userId = req.query.userId;
    const { amount } = req.body;
    // Get the current token value
    const userDoc = await db.collection(userCollection).where('userName', '==', userId).get();
    const currentTokenValue = userDoc.docs[0].data().token;

    // Calculate the new token value
    const newTokenValue = currentTokenValue + parseInt(amount);

    // Check if the new token value is less than 0
    if (newTokenValue < 0) {
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ error: "Need more balance. Token value cannot be less than 0" });
    }
    await (await db.collection(userCollection).where('userName', '==', userId).get()).docs[0].ref.update({token : admin.firestore.FieldValue.increment(parseInt(amount))})
    .then((_response) => {
      return res
        .status(StatusCodes.OK)
        .json({ status: "successfully added" });
    })
    .catch((error: any) => {
      return res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .json({ error: error.message });
    });
  } catch(error)
  {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(error);
  }
}

// Define a function to sort users by points and update their rank
// async function updateRanks(): Promise<void> {
//   // Get all the users from Firestore
//   const users = db.collection(userCollection);
//   // Query the collection to get all documents sorted by points
//   users.orderBy("point", "desc").get()
//   .then((querySnapshot) => {
//     let rank = 1;
//     querySnapshot.forEach((doc) => {
//       doc.ref.update({
//         rank: rank,
//       })
//       .then(() => {
//         console.log(`Document ${doc.id} updated successfully`);
//       })
//       .catch((error) => {
//         console.error(`Error updating document ${doc.id}:`, error);
//       });

//       rank ++;
//     });
//   })
//   .catch((error) => {
//     console.error('Error querying collection:', error);
//   })
// }

const user = { deleteUser, updateUser, postScore, getUser, addBalance, upgradeLevel};
export default user;
