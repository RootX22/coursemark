// Runs in the page's own world, where YouTube's player exposes the current video's details,
// and hands them to the extension's side with postMessage.
(() => {
  const POLL_MS = 250;
  const POLL_LIMIT = 40; // after an in-page navigation the player can take a few seconds to switch

  let timer;
  let attempts = 0;

  const watchId = () => new URLSearchParams(location.search).get('v');

  function currentDetails() {
    const response = document.getElementById('movie_player')?.getPlayerResponse?.();
    const details = response?.videoDetails;
    return details?.videoId && details.videoId === watchId() ? details : null;
  }

  function poll() {
    if (!watchId()) return;
    const details = currentDetails();
    if (!details) {
      attempts += 1;
      if (attempts < POLL_LIMIT) timer = setTimeout(poll, POLL_MS);
      return;
    }
    const video = {
      id: details.videoId,
      title: details.title ?? '',
      channel: details.author ?? '',
      duration: Number(details.lengthSeconds),
      description: details.shortDescription ?? '',
      live: Boolean(details.isLive || details.isUpcoming),
    };
    window.postMessage({ coursemark: 'video', video }, location.origin);
  }

  function announce() {
    clearTimeout(timer);
    attempts = 0;
    poll();
  }

  document.addEventListener('yt-navigate-finish', announce);
  window.addEventListener('message', (event) => {
    if (event.source === window && event.data?.coursemark === 'ask') announce();
  });
  announce();
})();
