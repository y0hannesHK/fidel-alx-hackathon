// Interface text for Fidel's own controls, in English and Amharic.
// (Able Player's own button labels are in player/i18n/am.json.)
//
// Placeholders like {n} are filled in by t(). Keep text short and plain.
// Amharic text must be checked by a fluent speaker before release.

export const STRINGS = {
  en: {
    settings: 'Accessibility settings',
    interfaceLanguage: 'Interface language',

    captions: 'Captions',
    captionLanguage: 'Caption language',
    off: 'Off',
    textSize: 'Text size',
    smaller: 'Smaller captions',
    larger: 'Larger captions',
    sizeNow: 'Caption size {size}',
    colours: 'Colours',
    whiteOnBlack: 'White on black',
    yellowOnBlack: 'Yellow on black',
    blackOnWhite: 'Black on white',
    blackOnCream: 'Black on cream',
    background: 'Background',
    solid: 'Solid',
    position: 'Position',
    belowVideo: 'Below the video',
    overBottom: 'Over the video, at the bottom',
    overTop: 'Over the video, at the top',

    sign: 'Sign language',
    signVideo: 'Sign language video',
    showSign: 'Show sign language',
    noSign: 'This lesson does not have a sign language video yet.',
    signPlace: 'Where to show it',
    besideVideo: 'Beside the video',
    overVideo: 'Over the video',
    size: 'Size',
    small: 'Small',
    medium: 'Medium',
    large: 'Large',
    corner: 'Move to corner',
    topLeft: 'Top left',
    topRight: 'Top right',
    bottomLeft: 'Bottom left',
    bottomRight: 'Bottom right',

    transcript: 'Transcript',
    searchLabel: 'Search the transcript',
    search: 'Search',
    results: '{n} results for “{q}”.',
    oneResult: '1 result for “{q}”.',
    noResults: 'No results for “{q}”.',
    playFrom: 'Play from {time}',

    draftNotice: 'These Amharic captions are machine-generated and not yet reviewed.',
  },

  am: {
    settings: 'የተደራሽነት ቅንብሮች',
    interfaceLanguage: 'የማሳያ ቋንቋ',

    captions: 'የግርጌ ጽሑፍ',
    captionLanguage: 'የግርጌ ጽሑፍ ቋንቋ',
    off: 'ጠፍቷል',
    textSize: 'የፊደል መጠን',
    smaller: 'የግርጌ ጽሑፉን አሳንስ',
    larger: 'የግርጌ ጽሑፉን አስፋ',
    sizeNow: 'የግርጌ ጽሑፍ መጠን {size}',
    colours: 'ቀለሞች',
    whiteOnBlack: 'ነጭ በጥቁር ላይ',
    yellowOnBlack: 'ቢጫ በጥቁር ላይ',
    blackOnWhite: 'ጥቁር በነጭ ላይ',
    blackOnCream: 'ጥቁር በክሬም ቀለም ላይ',
    background: 'ዳራ',
    solid: 'ሙሉ',
    position: 'ቦታ',
    belowVideo: 'ከቪዲዮው በታች',
    overBottom: 'በቪዲዮው ላይ፣ ከታች',
    overTop: 'በቪዲዮው ላይ፣ ከላይ',

    sign: 'የምልክት ቋንቋ',
    signVideo: 'የምልክት ቋንቋ ቪዲዮ',
    showSign: 'የምልክት ቋንቋ አሳይ',
    noSign: 'ለዚህ ትምህርት የምልክት ቋንቋ ቪዲዮ ገና የለም።',
    signPlace: 'የት ይታይ',
    besideVideo: 'ከቪዲዮው ጎን',
    overVideo: 'በቪዲዮው ላይ',
    size: 'መጠን',
    small: 'ትንሽ',
    medium: 'መካከለኛ',
    large: 'ትልቅ',
    corner: 'ወደ ጥግ አንቀሳቅስ',
    topLeft: 'ላይ ግራ',
    topRight: 'ላይ ቀኝ',
    bottomLeft: 'ታች ግራ',
    bottomRight: 'ታች ቀኝ',

    transcript: 'ግልባጭ',
    searchLabel: 'ግልባጩን ፈልግ',
    search: 'ፈልግ',
    results: 'ለ“{q}” {n} ውጤቶች ተገኝተዋል።',
    oneResult: 'ለ“{q}” 1 ውጤት ተገኝቷል።',
    noResults: 'ለ“{q}” ምንም ውጤት አልተገኘም።',
    playFrom: 'ከ{time} ጀምሮ አጫውት',

    draftNotice: 'እነዚህ የአማርኛ የግርጌ ጽሑፎች በማሽን የተዘጋጁ ሲሆኑ ገና በሰው አልተገመገሙም።',
  },
};

export const UI_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'am', name: 'አማርኛ' },
];

/** Translate a key into the given language, filling in {placeholders}. */
export function t(lang, key, values = {}) {
  const table = STRINGS[lang] || STRINGS.en;
  const text = table[key] ?? STRINGS.en[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
}
