export interface Env {
  GREETING: string;
}

export function messageForPath(pathname: string, env: Env): string {
  if (pathname === "/health") {
    return "ok";
  }

  return `${env.GREETING}: ${pathname}`;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    return Response.json({
      message: messageForPath(url.pathname, env),
      runtime: navigator.userAgent,
    });
  },
};
