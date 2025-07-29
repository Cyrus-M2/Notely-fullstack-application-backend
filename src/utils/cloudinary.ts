
import { v2 as cloudinary } from "cloudinary";
import { UploadApiResponse, UploadApiOptions } from "cloudinary";

import { CloudinaryUploadResult } from "../types";

// Configuring Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Uploading image to Cloudinary
export const uploadToCloudinary = async (
  fileBuffer: Buffer,
  options: Partial<UploadApiOptions> = {}
): Promise<CloudinaryUploadResult> => {
  return new Promise((resolve, reject) => {
    const uploadOptions: UploadApiOptions = {
      resource_type: "auto",
      folder: "notely/avatars",
      transformation: [
        { width: 200, height: 200, crop: "fill", quality: "auto" }
      ],
      ...options,
    };

    cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
      if (error) return reject(error);
      if (!result) return reject(new Error("Upload failed"));
      resolve(result as CloudinaryUploadResult);
    }).end(fileBuffer);
  });
};

// Deleting image from Cloudinary
export const deleteFromCloudinary = async (publicId: string): Promise<any> => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    throw new Error("Failed to delete image from Cloudinary");
  }
};
