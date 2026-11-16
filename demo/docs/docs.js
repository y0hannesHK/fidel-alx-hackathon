// Fidel component docs: the small scripts every docs page shares.
// Written by hand (not generated). Everything here is an enhancement: the
// pages work without JavaScript (the language switch and the filter box are
// hidden until this script shows them).
//  - English / Amharic switch for the site chrome, remembered in localStorage
//  - Copy buttons for code (with a fallback that selects the code)
//  - The filter box on the start page, which announces the count politely
(function () {
  'use strict';
  var KEY = 'fidel-docs-lang';
  var TEXT = {
    en: { count: '{n} of {total} components shown.', none: 'No component matches. Try another word.', copied: 'Copied.', selected: 'Code selected. Press Ctrl+C to copy.' },
    am: { count: 'ከ{total} ክፍሎች {n} ይታያሉ።', none: 'የሚዛመድ ክፍል የለም። ሌላ ቃል ይሞክሩ።', copied: 'ተቀድቷል።', selected: 'ኮዱ ተመርጧል። ለመቅዳት Ctrl+C ይጫኑ።' },
  };
  var root = document.documentElement;

  function lang() { return root.getAttribute('data-ui-lang') === 'am' ? 'am' : 'en'; }

  function showLanguage(code) {
    if (code === 'am') root.setAttribute('data-ui-lang', 'am');
    else root.removeAttribute('data-ui-lang');
    document.title = root.getAttribute('data-title-' + code) || document.title;
    document.querySelectorAll('[data-set-lang]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-set-lang') === code));
    });
    document.querySelectorAll('[data-label-' + code + ']').forEach(function (el) {
      el.setAttribute('aria-label', el.getAttribute('data-label-' + code));
    });
    document.querySelectorAll('.copy-status').forEach(function (s) { s.textContent = ''; });
    if (filter) updateFilter(false);
  }

  // --- Filter (start page only) -------------------------------------------
  var input = document.getElementById('filter');
  var filter = input && input.closest('.filter');
  var status = document.getElementById('filter-status');
  var noMatch = document.getElementById('no-match');
  var items = Array.prototype.slice.call(document.querySelectorAll('[data-search]'));
  var timer = null;

  function updateFilter(announce) {
    var words = input.value.toLowerCase().split(/\s+/).filter(Boolean);
    var shown = 0;
    items.forEach(function (item) {
      var text = item.getAttribute('data-search');
      var match = words.every(function (w) { return text.indexOf(w) !== -1; });
      item.hidden = !match;
      if (match) shown++;
    });
    document.querySelectorAll('[data-group]').forEach(function (group) {
      group.hidden = !group.querySelector('[data-search]:not([hidden])');
    });
    var t = TEXT[lang()];
    noMatch.hidden = shown > 0;
    noMatch.lang = lang();
    noMatch.textContent = shown ? '' : t.none;
    // The count is said once the learner stops typing, not on every key.
    clearTimeout(timer);
    var message = words.length ? t.count.replace('{n}', shown).replace('{total}', items.length) : '';
    if (!announce) { status.lang = lang(); status.textContent = message; return; }
    timer = setTimeout(function () { status.lang = lang(); status.textContent = message; }, 600);
  }

  if (filter) {
    filter.hidden = false;
    input.addEventListener('input', function () { updateFilter(true); });
  }

  // --- Language switch -------------------------------------------------------
  var langSwitch = document.querySelector('.lang-switch');
  if (langSwitch) langSwitch.hidden = false;
  showLanguage(lang());

  document.addEventListener('click', function (event) {
    var langButton = event.target.closest('[data-set-lang]');
    if (langButton) {
      showLanguage(langButton.getAttribute('data-set-lang'));
      try { localStorage.setItem(KEY, lang()); } catch (e) { /* private mode: not remembered */ }
      return;
    }
    // --- Copy ---------------------------------------------------------------
    var copyButton = event.target.closest('[data-copy]');
    if (!copyButton) return;
    var code = document.getElementById(copyButton.getAttribute('data-copy'));
    var copyStatus = copyButton.parentNode.querySelector('.copy-status');
    function say(key) { copyStatus.lang = lang(); copyStatus.textContent = TEXT[lang()][key]; }
    function selectCode() {
      var range = document.createRange();
      range.selectNodeContents(code);
      getSelection().removeAllRanges();
      getSelection().addRange(range);
      say('selected');
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(code.textContent).then(function () { say('copied'); }, selectCode);
    } else {
      selectCode();
    }
  });
})();
