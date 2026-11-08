self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  const data = {
    title: "Life Flow",
    body: "오늘 계획을 입력해 주세요.",
    tag: "life-flow-reminder",
    url: "/?entry=intake"
  };

  if (event.data) {
    const payload = event.data.text();

    try {
      const parsed = JSON.parse(payload);
      if (parsed && typeof parsed === "object") {
        if (typeof parsed.title === "string" && parsed.title) data.title = parsed.title;
        if (typeof parsed.body === "string" && parsed.body) data.body = parsed.body;
        if (typeof parsed.url === "string" && parsed.url) data.url = parsed.url;
        if (typeof parsed.tag === "string" && parsed.tag) data.tag = parsed.tag;
      }
    } catch {
      if (payload) data.body = payload;
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      icon: "/icon.svg",
      badge: "/icon.svg",
      data: { url: data.url }
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const requestedUrl = event.notification.data?.url || "/";
  const parsedUrl = new URL(requestedUrl, self.location.origin);
  const targetUrl = parsedUrl.origin === self.location.origin ? parsedUrl.href : new URL("/", self.location.origin).href;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existingWindow = windows.find((client) => client.url.startsWith(self.location.origin));
    if (existingWindow) {
      await existingWindow.navigate(targetUrl);
      return existingWindow.focus();
    }
    return self.clients.openWindow(targetUrl);
  })());
});
