import type { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../../configs/prisma";

const isAuthenticated = async (req: any, res: Response, next: NextFunction) => {
  try {
    const token =
      req.cookies["access_token"] || req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "Unauthorized! Token missing" });
    }

    let decoded: { id: number };
    try {
      decoded = jwt.verify(
        token,
        process.env.ACCESS_TOKEN_SECRET!,
        { algorithms: ["HS256"] },
      ) as typeof decoded;
    } catch (err) {
      return res.status(401).json({ message: "Invalid access token" });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, name: true, email: true, created_at: true },
    });

    if (!user) {
      return res.status(401).json({ message: "Account not found" });
    }

    req.user = user;
    next();
  } catch {
    return res.status(500).json({ message: "Internal server error" });
  }
};

export default isAuthenticated;
