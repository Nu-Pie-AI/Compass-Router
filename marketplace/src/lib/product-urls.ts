const DEFAULT_COMPASS_ROUTER_URL = "https://compass-router-web-c4psf2dvua-uc.a.run.app";

export const compassRouterUrl =
  process.env.NEXT_PUBLIC_COMPASS_ROUTER_URL ||
  process.env.COMPASS_ROUTER_URL ||
  DEFAULT_COMPASS_ROUTER_URL;
