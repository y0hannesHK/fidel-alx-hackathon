// The lesson page opened from a course (inlined into it). When the player
// says the lesson was watched to the end (fidel-complete), or the learner
// presses "Mark as complete", tell the Fidel
// server, which sends "completed" to the course's gradebook. The result is
// shown and announced in words (role="status"); if it fails, "Try again".
(function () {
  var data = JSON.parse(document.getElementById('lti-data').textContent);
  var result = document.getElementById('lti-result');
  var retry = document.getElementById('lti-retry');
  var sending = false;
  var finished = false;

  var MESSAGES = {
    sending: ['wait', 'Saving to your course…', 'በኮርስዎ በማስቀመጥ ላይ…'],
    saved: ['ok', '✓ Saved to your course: lesson completed.', '✓ በኮርስዎ ተቀምጧል፦ ትምህርቱ ተጠናቋል።'],
    no_gradebook: ['ok', '✓ Lesson completed. Your course does not keep a grade for this activity.',
      '✓ ትምህርቱ ተጠናቋል። ኮርስዎ ለዚህ እንቅስቃሴ ውጤት አይመዘግብም።'],
    launch_expired: ['bad', 'Not saved: this lesson was opened more than a day ago. Open it again from your course and finish it there.',
      'አልተቀመጠም፦ ይህ ትምህርት ከአንድ ቀን በፊት ነው የተከፈተው። ከኮርስዎ እንደገና ከፍተው እዚያ ይጨርሱት።'],
    offline: ['bad', 'Not saved yet: no internet connection. Try again when you are back online.',
      'ገና አልተቀመጠም፦ የኢንተርኔት ግንኙነት የለም። ሲመለስ እንደገና ይሞክሩ።'],
    failed: ['bad', 'Not saved to your course yet: Fidel could not reach its gradebook. Try again.',
      'ገና በኮርስዎ አልተቀመጠም፦ ፊደል የውጤት መዝገቡን ማግኘት አልቻለም። እንደገና ይሞክሩ።'],
  };

  function say(name) {
    var m = MESSAGES[name];
    var en = document.createElement('p');
    en.lang = 'en';
    en.textContent = m[1];
    var am = document.createElement('p');
    am.lang = 'am';
    am.textContent = m[2];
    result.className = 'status ' + m[0];
    result.replaceChildren(en, am);
  }

  function send() {
    if (sending || finished) return;
    sending = true;
    retry.hidden = true;
    say('sending');
    fetch('/lti/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ launch: data.launch }),
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (body) {
        sending = false;
        if (response.ok) {
          finished = true;
          say(body.saved ? 'saved' : 'no_gradebook');
        } else if (body.reason === 'launch_expired') {
          finished = true;
          say('launch_expired');
        } else {
          say('failed');
          retry.hidden = false;
        }
      });
    }).catch(function () {
      sending = false;
      say('offline');
      retry.hidden = false;
    });
  }

  document.getElementById('lesson-player').addEventListener('fidel-complete', send);
  // "Mark as complete" (pressed, not un-pressed) counts too: not everyone watches to the end.
  document.getElementById('mark-complete').addEventListener('fidel-mark-complete', function (event) {
    if (event.detail && event.detail.done) send();
  });
  retry.addEventListener('click', send);
})();
