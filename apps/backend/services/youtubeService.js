import fs from "fs";
import path from "path";
import { google } from "googleapis";

const {
  YOUTUBE_CLIENT_ID,
  YOUTUBE_CLIENT_SECRET,
  YOUTUBE_REFRESH_TOKEN,
} = process.env;

const getOAuthClient = () => {
  if (!YOUTUBE_CLIENT_ID || !YOUTUBE_CLIENT_SECRET || !YOUTUBE_REFRESH_TOKEN) {
    throw new Error(
      "YouTube credentials are not configured. Set YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, and YOUTUBE_REFRESH_TOKEN in .env"
    );
  }

  const auth = new google.auth.OAuth2(YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET);
  auth.setCredentials({ refresh_token: YOUTUBE_REFRESH_TOKEN });
  return auth;
};

export const uploadVideoToYouTube = async ({ filePath, title, description, tags = [], privacyStatus = "public" }) => {
  const auth = getOAuthClient();
  const youtube = google.youtube({ version: "v3", auth });
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Video file not found at path: ${absolutePath}`);
  }

  const fileSize = fs.statSync(absolutePath).size;

  const response = await youtube.videos.insert(
    {
      part: ["snippet", "status"],
      notifySubscribers: false,
      requestBody: {
        snippet: {
          title,
          description,
          tags,
        },
        status: {
          privacyStatus,
        },
      },
      media: {
        body: fs.createReadStream(absolutePath),
      },
    },
    {
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    }
  );

  if (!response.data || !response.data.id) {
    throw new Error("YouTube upload did not return a video ID");
  }

  return response.data;
};
