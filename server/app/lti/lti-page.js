// Browser side of an LTI sign-in (inlined into Fidel's /lti/ pages).
//
// Login page: keep the state where the launch can find it, then go to the
// platform. Two places are tried:
//   1. the platform's own storage (LTI client-side storage, lti_storage_target),
//      for browsers that block cookies inside the course page's frame;
//   2. a cookie, set by the server with this page.
// If neither works (a frame that blocks cookies, no platform storage), the page
// offers "Open in a new window", where cookies work.
//
// Launch check page: the cookie was blocked, so read the state back from the
// platform's storage; only if it matches, send the launch on.
(function () {
  var data = JSON.parse(document.getElementById('lti-data').textContent);

  function platformFrame() {
    if (!data.storageTarget || window.parent === window) return null;
    try {
      return data.storageTarget === '_parent' ? window.parent : window.parent.frames[data.storageTarget] || null;
    } catch (e) {
      return null;
    }
  }

  // One request to the platform's storage; calls back with the response, or null.
  function ask(message, callback) {
    var frame = platformFrame();
    if (!frame) return callback(null);
    var id = 'fidel-' + Math.random().toString(36).slice(2);
    var timer = setTimeout(function () { finish(null); }, 2000);
    function finish(response) {
      clearTimeout(timer);
      window.removeEventListener('message', listen);
      callback(response);
    }
    function listen(event) {
      if (event.origin !== data.platformOrigin || !event.data || event.data.message_id !== id) return;
      finish(event.data.error ? null : event.data);
    }
    window.addEventListener('message', listen);
    message.message_id = id;
    frame.postMessage(message, data.platformOrigin);
  }

  function show(id) {
    document.getElementById('lti-wait').hidden = true;
    document.getElementById(id).hidden = false;
    document.querySelector('h1').focus();
  }

  function cookiesWork() {
    try {
      document.cookie = 'fidel_lti_check=1; path=/lti/; max-age=60' + (location.protocol === 'https:' ? '; SameSite=None; Secure; Partitioned' : '');
      return document.cookie.indexOf('fidel_lti_check=1') !== -1;
    } catch (e) {
      return false;
    }
  }

  if (data.page === 'login') {
    ask({ subject: 'lti.put_data', key: 'state_' + data.state, value: data.state }, function (stored) {
      if (stored || window.top === window || cookiesWork()) location.replace(data.authUrl);
      else show('lti-new-window');
    });
  } else if (data.page === 'launch-check') {
    ask({ subject: 'lti.get_data', key: 'state_' + data.state }, function (response) {
      if (response && response.value === data.state) document.getElementById('lti-continue').submit();
      else show('lti-check-failed');
    });
  }
})();
