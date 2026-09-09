(function installGitHubPublishRetry() {
  "use strict";

  const nativeFetch = window.fetch.bind(window);
  const mergePathPattern = /^\/repos\/[^/]+\/[^/]+\/pulls\/\d+\/merge$/;
  const retryDelays = [250, 500, 1000];

  function wait(milliseconds) {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  }

  async function isStaleHeadResponse(response) {
    if (response.status !== 409) return false;

    try {
      const error = await response.clone().json();
      return (
        typeof error.message === "string" &&
        /head branch was modified/i.test(error.message)
      );
    } catch (_error) {
      return false;
    }
  }

  window.fetch = async function fetchWithFreshPullRequestHead(input, init) {
    const originalRequest = new Request(input, init);
    let response = await nativeFetch(originalRequest.clone());
    const url = new URL(originalRequest.url, window.location.href);

    if (
      originalRequest.method !== "PUT" ||
      !mergePathPattern.test(url.pathname) ||
      !(await isStaleHeadResponse(response))
    ) {
      return response;
    }

    let mergeBody;
    try {
      mergeBody = JSON.parse(await originalRequest.clone().text());
    } catch (_error) {
      return response;
    }

    const pullRequestUrl = new URL(url.href);
    pullRequestUrl.pathname = pullRequestUrl.pathname.replace(/\/merge$/, "");

    for (const delay of retryDelays) {
      await wait(delay);

      const pullRequestResponse = await nativeFetch(
        new Request(pullRequestUrl, {
          method: "GET",
          headers: originalRequest.headers,
          cache: "no-store",
          credentials: originalRequest.credentials,
        }),
      );

      if (!pullRequestResponse.ok) return response;

      const pullRequest = await pullRequestResponse.json();
      const latestHead =
        pullRequest && pullRequest.head && pullRequest.head.sha;
      if (typeof latestHead !== "string" || latestHead.length === 0)
        return response;

      mergeBody.sha = latestHead;
      response = await nativeFetch(
        new Request(url, {
          method: "PUT",
          headers: originalRequest.headers,
          body: JSON.stringify(mergeBody),
          cache: "no-store",
          credentials: originalRequest.credentials,
        }),
      );

      if (!(await isStaleHeadResponse(response))) return response;
    }

    return response;
  };
})();
