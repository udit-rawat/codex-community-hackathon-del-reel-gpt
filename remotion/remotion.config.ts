import { Config } from "@remotion/cli/config";

// H.264 MP4 output — compatible with Telegram delivery
Config.setCodec("h264");

// JPEG frame rendering — faster than PNG, visually indistinguishable at 95 quality
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);

// Pixel format required for H.264 compatibility
Config.setPixelFormat("yuv420p");
