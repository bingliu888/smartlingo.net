import type { SmartLingoInterfaceLanguage, SmartLingoLearningLanguage, SmartLingoLevel } from "./smartlingo-learning.ts";

export const SMARTLINGO_SENTENCE_CONTENT_VERSION = "2026-08-21.2" as const;
export const SMARTLINGO_SENTENCES_PER_COURSE = 120 as const;
export const SMARTLINGO_SENTENCES_PER_ROUND = 10 as const;

type Scenario = {
  id: string;
  zh: string;
  en: string;
  places: Record<SmartLingoLearningLanguage, string>;
};

const SCENARIOS: readonly Scenario[] = [
  ["airport", "机场", "the airport", ["机场", "the airport", "el aeropuerto", "空港", "공항", "l’aéroport", "der Flughafen", "аэропорт", "l’aeroporto", "o aeroporto", "المطار", "हवाई अड्डा"]],
  ["hotel", "酒店", "the hotel", ["酒店", "the hotel", "el hotel", "ホテル", "호텔", "l’hôtel", "das Hotel", "отель", "l’hotel", "o hotel", "الفندق", "होटल"]],
  ["restaurant", "餐厅", "the restaurant", ["餐厅", "the restaurant", "el restaurante", "レストラン", "식당", "le restaurant", "das Restaurant", "ресторан", "il ristorante", "o restaurante", "المطعم", "रेस्तराँ"]],
  ["hospital", "医院", "the hospital", ["医院", "the hospital", "el hospital", "病院", "병원", "l’hôpital", "das Krankenhaus", "больница", "l’ospedale", "o hospital", "المستشفى", "अस्पताल"]],
  ["cafe", "咖啡店", "the coffee shop", ["咖啡店", "the coffee shop", "la cafetería", "カフェ", "카페", "le café", "das Café", "кафе", "il bar", "o café", "المقهى", "कैफ़े"]],
  ["school", "学校", "the school", ["学校", "the school", "la escuela", "学校", "학교", "l’école", "die Schule", "школа", "la scuola", "a escola", "المدرسة", "स्कूल"]],
  ["library", "图书馆", "the library", ["图书馆", "the library", "la biblioteca", "図書館", "도서관", "la bibliothèque", "die Bibliothek", "библиотека", "la biblioteca", "a biblioteca", "المكتبة", "पुस्तकालय"]],
  ["grocery", "食品店", "the grocery store", ["食品店", "the grocery store", "el supermercado", "食料品店", "식료품점", "l’épicerie", "der Supermarkt", "продуктовый магазин", "il supermercato", "o supermercado", "متجر البقالة", "किराने की दुकान"]],
  ["transit", "车站", "the station", ["车站", "the station", "la estación", "駅", "역", "la gare", "der Bahnhof", "станция", "la stazione", "a estação", "المحطة", "स्टेशन"]],
  ["pharmacy", "药店", "the pharmacy", ["药店", "the pharmacy", "la farmacia", "薬局", "약국", "la pharmacie", "die Apotheke", "аптека", "la farmacia", "a farmácia", "الصيدلية", "दवा की दुकान"]],
  ["bank", "银行", "the bank", ["银行", "the bank", "el banco", "銀行", "은행", "la banque", "die Bank", "банк", "la banca", "o banco", "البنك", "बैंक"]],
  ["police", "警察服务台", "the police help desk", ["警察服务台", "the police help desk", "el puesto de policía", "警察案内所", "경찰 안내소", "le poste de police", "die Polizeiwache", "полицейский участок", "il posto di polizia", "o posto policial", "مركز الشرطة", "पुलिस सहायता केंद्र"]],
].map(([id, zh, en, places]) => ({
  id: id as string,
  zh: zh as string,
  en: en as string,
  places: Object.fromEntries((["zh", "en", "es", "ja", "ko", "fr", "de", "ru", "it", "pt", "ar", "hi"] as const).map((code, index) => [code, (places as string[])[index]])) as Record<SmartLingoLearningLanguage, string>,
}));

type TargetBuilder = (place: string) => readonly string[];

type LevelExtension = { intermediate: readonly string[]; advanced: readonly string[] };

const TARGET_BUILDERS: Record<SmartLingoLearningLanguage, TargetBuilder> = {
  zh: p => [`${p}在哪里？`, `我在找${p}。`, `请告诉我怎么去${p}。`, `${p}离这里远吗？`, `${p}现在开门吗？`, `我需要去${p}。`, `请带我去${p}。`, `我们可以在${p}见面吗？`, `去${p}要多长时间？`, `谢谢你帮我找到${p}。`],
  en: p => [`Where is ${p}?`, `I am looking for ${p}.`, `Please show me how to get to ${p}.`, `Is ${p} far from here?`, `Is ${p} open now?`, `I need to go to ${p}.`, `Please take me to ${p}.`, `Can we meet at ${p}?`, `How long does it take to reach ${p}?`, `Thank you for helping me find ${p}.`],
  es: p => [`¿Dónde está ${p}?`, `Estoy buscando ${p}.`, `Por favor, dígame cómo llegar a ${p}.`, `¿Está ${p} lejos de aquí?`, `¿Está abierto ${p} ahora?`, `Necesito ir a ${p}.`, `Por favor, lléveme a ${p}.`, `¿Podemos encontrarnos en ${p}?`, `¿Cuánto se tarda en llegar a ${p}?`, `Gracias por ayudarme a encontrar ${p}.`],
  ja: p => [`${p}はどこですか。`, `${p}を探しています。`, `${p}への行き方を教えてください。`, `${p}はここから遠いですか。`, `${p}は今開いていますか。`, `${p}へ行く必要があります。`, `${p}へ連れて行ってください。`, `${p}で会えますか。`, `${p}までどのくらいかかりますか。`, `${p}を探すのを手伝ってくれてありがとうございます。`],
  ko: p => [`${p}은 어디예요?`, `${p}을 찾고 있어요.`, `${p}에 가는 길을 알려 주세요.`, `${p}은 여기서 멀어요?`, `${p}은 지금 열려 있어요?`, `${p}에 가야 해요.`, `${p}에 데려다 주세요.`, `${p}에서 만날 수 있어요?`, `${p}까지 얼마나 걸려요?`, `${p}을 찾는 것을 도와주셔서 감사합니다.`],
  fr: p => [`Où se trouve ${p} ?`, `Je cherche ${p}.`, `Montrez-moi comment aller à ${p}, s’il vous plaît.`, `${p} est loin d’ici ?`, `${p} est ouvert maintenant ?`, `Je dois aller à ${p}.`, `Emmenez-moi à ${p}, s’il vous plaît.`, `Pouvons-nous nous retrouver à ${p} ?`, `Combien de temps faut-il pour aller à ${p} ?`, `Merci de m’aider à trouver ${p}.`],
  de: p => [`Wo ist ${p}?`, `Ich suche ${p}.`, `Bitte zeigen Sie mir den Weg zu ${p}.`, `Ist ${p} weit von hier?`, `Ist ${p} jetzt geöffnet?`, `Ich muss zu ${p}.`, `Bitte bringen Sie mich zu ${p}.`, `Können wir uns bei ${p} treffen?`, `Wie lange dauert es bis zu ${p}?`, `Danke, dass Sie mir helfen, ${p} zu finden.`],
  ru: p => [`Где находится ${p}?`, `Я ищу ${p}.`, `Пожалуйста, покажите, как пройти в ${p}.`, `${p} далеко отсюда?`, `${p} сейчас открыт?`, `Мне нужно в ${p}.`, `Пожалуйста, отвезите меня в ${p}.`, `Мы можем встретиться у места «${p}»?`, `Сколько времени идти до места «${p}»?`, `Спасибо, что помогли мне найти ${p}.`],
  it: p => [`Dov’è ${p}?`, `Sto cercando ${p}.`, `Per favore, mi mostri come arrivare a ${p}.`, `${p} è lontano da qui?`, `${p} è aperto adesso?`, `Devo andare a ${p}.`, `Per favore, mi porti a ${p}.`, `Possiamo incontrarci a ${p}?`, `Quanto tempo ci vuole per arrivare a ${p}?`, `Grazie per avermi aiutato a trovare ${p}.`],
  pt: p => [`Onde fica ${p}?`, `Estou procurando ${p}.`, `Por favor, mostre-me como chegar a ${p}.`, `${p} fica longe daqui?`, `${p} está aberto agora?`, `Preciso ir a ${p}.`, `Por favor, leve-me a ${p}.`, `Podemos nos encontrar em ${p}?`, `Quanto tempo leva para chegar a ${p}?`, `Obrigado por me ajudar a encontrar ${p}.`],
  ar: p => [`أين ${p}؟`, `أنا أبحث عن ${p}.`, `من فضلك، أخبرني كيف أصل إلى ${p}.`, `هل ${p} بعيد من هنا؟`, `هل ${p} مفتوح الآن؟`, `أحتاج إلى الذهاب إلى ${p}.`, `من فضلك، خذني إلى ${p}.`, `هل يمكننا أن نلتقي عند ${p}؟`, `كم يستغرق الوصول إلى ${p}؟`, `شكرًا لمساعدتي في العثور على ${p}.`],
  hi: p => [`${p} कहाँ है?`, `मैं ${p} ढूँढ रहा हूँ।`, `कृपया मुझे ${p} जाने का रास्ता बताइए।`, `क्या ${p} यहाँ से दूर है?`, `क्या ${p} अभी खुला है?`, `मुझे ${p} जाना है।`, `कृपया मुझे ${p} ले चलिए।`, `क्या हम ${p} पर मिल सकते हैं?`, `${p} पहुँचने में कितना समय लगता है?`, `${p} ढूँढने में मेरी मदद करने के लिए धन्यवाद।`],
};

const ENGLISH_BUILD: TargetBuilder = p => [`Where is ${p}?`, `I am looking for ${p}.`, `Please show me how to get to ${p}.`, `Is ${p} far from here?`, `Is ${p} open now?`, `I need to go to ${p}.`, `Please take me to ${p}.`, `Can we meet at ${p}?`, `How long does it take to reach ${p}?`, `Thank you for helping me find ${p}.`];
const CHINESE_BUILD: TargetBuilder = p => [`${p}在哪里？`, `我在找${p}。`, `请告诉我怎么去${p}。`, `${p}离这里远吗？`, `${p}现在开门吗？`, `我需要去${p}。`, `请带我去${p}。`, `我们可以在${p}见面吗？`, `去${p}要多长时间？`, `谢谢你帮我找到${p}。`];

/**
 * Ten discourse extensions per level turn each scene's ten A1 survival
 * utterances into genuinely different A2-B1 and B1+-B2 tasks. They add
 * reasons, constraints, alternatives, reported information, and polite
 * negotiation instead of merely prepending a courtesy phrase.
 */
const LEVEL_EXTENSIONS: Record<SmartLingoLearningLanguage, LevelExtension> = {
  zh: {
    intermediate: ["我今天下午在那里有预约。", "我看过地图，可还是没有找到。", "我想在中午以前到达。", "如果步行太远，我可以坐公交车。", "我需要确认周末的营业时间。", "因为这是我今天最重要的安排。", "我带着行李，所以想走最方便的路线。", "我们到达以后再确认具体位置。", "我还需要预留排队的时间。", "你的说明让我顺利完成了今天的计划。"],
    advanced: ["因为行程可能临时改变，也请说明一个备用路线。", "虽然导航显示我已经到了，但入口似乎在另一条街。", "请比较最快和最方便的路线，并说明各自需要多久。", "如果公共交通暂停，请告诉我还有哪些可靠的选择。", "我想确认节假日安排是否会影响我已经预约的服务。", "这项安排关系到后面的行程，所以我需要一个准确的到达时间。", "考虑到无障碍通行和行李，请推荐换乘最少的路线。", "如果我们分头前往，请建议一个容易辨认的会合点。", "除了正常路程，我还想知道高峰时段通常要多预留多久。", "你的详细说明不仅解决了眼前的问题，也让我知道下次该如何安排。"],
  },
  en: {
    intermediate: ["I have an appointment there this afternoon.", "I checked the map, but I still could not find it.", "I would like to arrive before noon.", "If it is too far to walk, I can take a bus.", "I need to confirm the weekend opening hours.", "It is the most important stop on my schedule today.", "I have luggage, so I need the easiest route.", "We can confirm the exact location after we arrive.", "I also need to allow time for the line.", "Your directions helped me complete today's plan."],
    advanced: ["Because my schedule may change, please also explain an alternative route.", "Although the map says I have arrived, the entrance seems to be on another street.", "Please compare the fastest route with the most convenient one and explain how long each takes.", "If public transport is suspended, please tell me which reliable alternatives are available.", "I would like to confirm whether the holiday schedule affects the service I booked.", "This stop affects the rest of my itinerary, so I need an accurate arrival time.", "Considering accessibility and my luggage, please recommend the route with the fewest transfers.", "If we travel separately, please suggest a meeting point that is easy to recognize.", "Besides the normal journey, I would like to know how much extra time to allow during rush hour.", "Your detailed explanation solved the immediate problem and showed me how to plan next time."],
  },
  es: {
    intermediate: ["Tengo una cita allí esta tarde.", "Miré el mapa, pero todavía no lo encontré.", "Quisiera llegar antes del mediodía.", "Si está demasiado lejos para ir a pie, puedo tomar un autobús.", "Necesito confirmar el horario del fin de semana.", "Es la parada más importante de mi plan de hoy.", "Llevo equipaje, así que necesito la ruta más fácil.", "Podemos confirmar el lugar exacto cuando lleguemos.", "También necesito reservar tiempo para la fila.", "Sus indicaciones me ayudaron a completar el plan de hoy."],
    advanced: ["Como mi horario puede cambiar, explíqueme también una ruta alternativa.", "Aunque el mapa indica que ya llegué, la entrada parece estar en otra calle.", "Compare la ruta más rápida con la más cómoda y dígame cuánto tarda cada una.", "Si se suspende el transporte público, dígame qué alternativas fiables hay.", "Quisiera confirmar si el horario festivo afecta al servicio que reservé.", "Esta parada afecta al resto de mi itinerario, así que necesito una hora de llegada precisa.", "Teniendo en cuenta la accesibilidad y mi equipaje, recomiéndeme la ruta con menos transbordos.", "Si viajamos por separado, sugiera un punto de encuentro fácil de reconocer.", "Además del trayecto normal, quisiera saber cuánto tiempo extra debo prever en hora punta.", "Su explicación detallada resolvió el problema inmediato y me enseñó a planificar la próxima vez."],
  },
  ja: {
    intermediate: ["今日の午後、そこで予約があります。", "地図を見ましたが、まだ見つかりません。", "正午までに着きたいです。", "歩くには遠すぎるなら、バスに乗れます。", "週末の営業時間を確認したいです。", "今日はそこへ行くことが一番大切です。", "荷物があるので、一番楽な道が必要です。", "着いてから詳しい場所を確認できます。", "列に並ぶ時間も考える必要があります。", "案内のおかげで今日の予定を終えられました。"],
    advanced: ["予定が変わるかもしれないので、別の行き方も説明してください。", "地図では到着したことになっていますが、入口は別の通りにあるようです。", "最短の経路と最も便利な経路を比べ、それぞれの所要時間を教えてください。", "公共交通が止まった場合に利用できる確実な代替手段も教えてください。", "祝日の予定が予約したサービスに影響するか確認したいです。", "この予定は後の旅程に関わるので、正確な到着時刻が必要です。", "バリアフリーと荷物を考慮して、乗り換えが最も少ない経路を勧めてください。", "別々に向かう場合は、分かりやすい待ち合わせ場所を提案してください。", "通常の所要時間に加えて、ラッシュ時にはどのくらい余裕が必要か知りたいです。", "詳しい説明で今の問題が解決し、次回の計画方法も分かりました。"],
  },
  ko: {
    intermediate: ["오늘 오후에 그곳에서 약속이 있어요.", "지도를 봤지만 아직 찾지 못했어요.", "정오 전에 도착하고 싶어요.", "걷기에 너무 멀면 버스를 탈 수 있어요.", "주말 영업시간을 확인해야 해요.", "오늘 일정에서 가장 중요한 곳이에요.", "짐이 있어서 가장 편한 길이 필요해요.", "도착한 뒤에 정확한 위치를 확인할 수 있어요.", "줄을 서는 시간도 고려해야 해요.", "안내 덕분에 오늘 계획을 마칠 수 있었어요."],
    advanced: ["일정이 바뀔 수 있으니 대체 경로도 설명해 주세요.", "지도에는 도착했다고 나오지만 입구는 다른 거리에 있는 것 같아요.", "가장 빠른 길과 가장 편리한 길을 비교하고 각각 얼마나 걸리는지 알려 주세요.", "대중교통이 중단되면 이용할 수 있는 믿을 만한 대안도 알려 주세요.", "휴일 일정이 제가 예약한 서비스에 영향을 주는지 확인하고 싶어요.", "이 일정이 나머지 여정에 영향을 주므로 정확한 도착 시간이 필요해요.", "접근성과 짐을 고려해 환승이 가장 적은 경로를 추천해 주세요.", "따로 이동한다면 알아보기 쉬운 만남의 장소를 제안해 주세요.", "평소 이동 시간 외에 출퇴근 시간에는 얼마나 더 여유를 둬야 하는지 알고 싶어요.", "자세한 설명으로 당장의 문제가 해결됐고 다음 계획 방법도 알게 됐어요."],
  },
  fr: {
    intermediate: ["J’y ai un rendez-vous cet après-midi.", "J’ai consulté la carte, mais je ne l’ai toujours pas trouvé.", "Je voudrais arriver avant midi.", "Si c’est trop loin à pied, je peux prendre le bus.", "Je dois confirmer les horaires du week-end.", "C’est l’étape la plus importante de mon programme aujourd’hui.", "J’ai des bagages, donc il me faut l’itinéraire le plus simple.", "Nous pourrons confirmer l’endroit exact après notre arrivée.", "Je dois aussi prévoir du temps pour la file d’attente.", "Vos indications m’ont aidé à terminer le programme d’aujourd’hui."],
    advanced: ["Comme mon emploi du temps peut changer, expliquez-moi aussi un autre itinéraire.", "Bien que la carte indique que je suis arrivé, l’entrée semble se trouver dans une autre rue.", "Comparez l’itinéraire le plus rapide au plus pratique et précisez la durée de chacun.", "Si les transports publics sont interrompus, indiquez-moi les solutions fiables disponibles.", "Je voudrais vérifier si les horaires des jours fériés affectent le service que j’ai réservé.", "Cette étape conditionne le reste de mon itinéraire, j’ai donc besoin d’une heure d’arrivée précise.", "Compte tenu de l’accessibilité et de mes bagages, conseillez-moi le trajet avec le moins de correspondances.", "Si nous voyageons séparément, proposez un point de rendez-vous facile à reconnaître.", "En plus du trajet habituel, je voudrais savoir combien de temps prévoir aux heures de pointe.", "Votre explication détaillée a résolu le problème immédiat et m’a appris à mieux planifier la prochaine fois."],
  },
  de: {
    intermediate: ["Ich habe dort heute Nachmittag einen Termin.", "Ich habe auf die Karte geschaut, aber ich habe es noch nicht gefunden.", "Ich möchte vor Mittag ankommen.", "Wenn es zu weit zum Gehen ist, kann ich den Bus nehmen.", "Ich muss die Öffnungszeiten am Wochenende bestätigen.", "Es ist heute der wichtigste Stopp in meinem Plan.", "Ich habe Gepäck und brauche deshalb den einfachsten Weg.", "Nach unserer Ankunft können wir den genauen Ort bestätigen.", "Ich muss auch Zeit für die Warteschlange einplanen.", "Ihre Wegbeschreibung hat mir geholfen, meinen heutigen Plan zu erfüllen."],
    advanced: ["Da sich mein Zeitplan ändern kann, erklären Sie mir bitte auch eine alternative Route.", "Obwohl die Karte anzeigt, dass ich angekommen bin, scheint der Eingang in einer anderen Straße zu liegen.", "Vergleichen Sie bitte den schnellsten mit dem bequemsten Weg und nennen Sie die jeweilige Dauer.", "Falls der öffentliche Verkehr ausfällt, nennen Sie mir bitte verlässliche Alternativen.", "Ich möchte prüfen, ob der Feiertagsfahrplan den von mir gebuchten Service beeinflusst.", "Dieser Stopp wirkt sich auf den restlichen Reiseplan aus, deshalb brauche ich eine genaue Ankunftszeit.", "Empfehlen Sie mir unter Berücksichtigung der Barrierefreiheit und meines Gepäcks die Route mit den wenigsten Umstiegen.", "Wenn wir getrennt anreisen, schlagen Sie bitte einen leicht erkennbaren Treffpunkt vor.", "Zusätzlich zur normalen Fahrzeit möchte ich wissen, wie viel Reserve ich im Berufsverkehr einplanen sollte.", "Ihre ausführliche Erklärung hat das aktuelle Problem gelöst und mir gezeigt, wie ich das nächste Mal planen kann."],
  },
  ru: {
    intermediate: ["У меня там встреча сегодня днём.", "Я посмотрел карту, но всё ещё не нашёл это место.", "Я хотел бы приехать до полудня.", "Если идти слишком далеко, я могу поехать на автобусе.", "Мне нужно уточнить часы работы в выходные.", "Это самая важная остановка в моём плане на сегодня.", "У меня есть багаж, поэтому нужен самый удобный маршрут.", "Мы сможем уточнить точное место после прибытия.", "Мне также нужно учесть время ожидания в очереди.", "Ваши указания помогли мне выполнить сегодняшний план."],
    advanced: ["Поскольку расписание может измениться, объясните, пожалуйста, и запасной маршрут.", "Хотя карта показывает, что я уже прибыл, вход, похоже, находится на другой улице.", "Сравните самый быстрый и самый удобный маршруты и скажите, сколько времени занимает каждый.", "Если общественный транспорт остановится, расскажите, какие надёжные варианты останутся.", "Я хотел бы уточнить, повлияет ли праздничное расписание на заказанную мной услугу.", "Эта остановка влияет на весь дальнейший маршрут, поэтому мне нужно точное время прибытия.", "Учитывая доступность и багаж, посоветуйте маршрут с наименьшим числом пересадок.", "Если мы поедем отдельно, предложите заметное и удобное место встречи.", "Кроме обычного времени в пути, я хотел бы знать, какой запас нужен в час пик.", "Ваше подробное объяснение решило текущую проблему и помогло понять, как планировать в следующий раз."],
  },
  it: {
    intermediate: ["Ho un appuntamento lì questo pomeriggio.", "Ho controllato la mappa, ma non l’ho ancora trovato.", "Vorrei arrivare prima di mezzogiorno.", "Se è troppo lontano a piedi, posso prendere l’autobus.", "Devo confermare l’orario del fine settimana.", "È la tappa più importante del mio programma di oggi.", "Ho dei bagagli, quindi mi serve il percorso più semplice.", "Possiamo confermare il punto esatto dopo l’arrivo.", "Devo anche prevedere il tempo per la fila.", "Le sue indicazioni mi hanno aiutato a completare il programma di oggi."],
    advanced: ["Poiché il mio programma potrebbe cambiare, mi spieghi anche un percorso alternativo.", "Anche se la mappa indica che sono arrivato, l’ingresso sembra trovarsi in un’altra strada.", "Confronti il percorso più veloce con quello più comodo e indichi la durata di ciascuno.", "Se il trasporto pubblico viene sospeso, mi dica quali alternative affidabili sono disponibili.", "Vorrei verificare se l’orario festivo influisce sul servizio che ho prenotato.", "Questa tappa condiziona il resto dell’itinerario, quindi mi serve un orario di arrivo preciso.", "Considerando l’accessibilità e i bagagli, mi consigli il percorso con meno cambi.", "Se viaggiamo separatamente, suggerisca un punto d’incontro facile da riconoscere.", "Oltre al tragitto normale, vorrei sapere quanto tempo extra prevedere nell’ora di punta.", "La sua spiegazione dettagliata ha risolto il problema immediato e mi ha mostrato come pianificare la prossima volta."],
  },
  pt: {
    intermediate: ["Tenho um compromisso lá esta tarde.", "Consultei o mapa, mas ainda não encontrei o lugar.", "Gostaria de chegar antes do meio-dia.", "Se for longe demais para ir a pé, posso pegar um ônibus.", "Preciso confirmar o horário do fim de semana.", "É a parada mais importante do meu plano de hoje.", "Estou com bagagem, então preciso da rota mais fácil.", "Podemos confirmar o local exato depois de chegar.", "Também preciso reservar tempo para a fila.", "Suas orientações me ajudaram a concluir o plano de hoje."],
    advanced: ["Como meu horário pode mudar, explique também uma rota alternativa.", "Embora o mapa indique que cheguei, a entrada parece ficar em outra rua.", "Compare a rota mais rápida com a mais conveniente e informe quanto tempo leva cada uma.", "Se o transporte público for suspenso, diga quais alternativas confiáveis estão disponíveis.", "Gostaria de confirmar se o horário de feriado afeta o serviço que reservei.", "Esta parada afeta o restante do itinerário, por isso preciso de um horário de chegada preciso.", "Considerando a acessibilidade e a bagagem, recomende a rota com menos baldeações.", "Se viajarmos separadamente, sugira um ponto de encontro fácil de reconhecer.", "Além do trajeto normal, gostaria de saber quanto tempo extra reservar no horário de pico.", "Sua explicação detalhada resolveu o problema imediato e me mostrou como planejar da próxima vez."],
  },
  ar: {
    intermediate: ["لدي موعد هناك بعد ظهر اليوم.", "راجعت الخريطة، لكنني لم أجد المكان بعد.", "أود الوصول قبل الظهر.", "إذا كان بعيدًا جدًا للمشي، يمكنني ركوب الحافلة.", "أحتاج إلى تأكيد ساعات العمل في عطلة نهاية الأسبوع.", "إنها أهم محطة في جدول اليوم.", "معي أمتعة، لذلك أحتاج إلى أسهل طريق.", "يمكننا تأكيد المكان الدقيق بعد وصولنا.", "أحتاج أيضًا إلى تخصيص وقت للانتظار في الصف.", "ساعدتني إرشاداتك على إكمال خطة اليوم."],
    advanced: ["لأن جدولي قد يتغير، اشرح لي أيضًا طريقًا بديلًا.", "مع أن الخريطة تشير إلى أنني وصلت، يبدو أن المدخل في شارع آخر.", "قارن بين أسرع طريق وأكثرها راحة ووضح المدة التي يستغرقها كل منهما.", "إذا توقفت وسائل النقل العامة، فأخبرني بالبدائل الموثوقة المتاحة.", "أود التأكد مما إذا كان جدول العطلة يؤثر في الخدمة التي حجزتها.", "تؤثر هذه المحطة في بقية رحلتي، لذلك أحتاج إلى وقت وصول دقيق.", "مع مراعاة سهولة الوصول والأمتعة، أوصني بالطريق الذي يتطلب أقل عدد من التبديلات.", "إذا سافرنا منفصلين، فاقترح نقطة لقاء يسهل التعرف إليها.", "إضافة إلى مدة الرحلة المعتادة، أود معرفة الوقت الإضافي اللازم في ساعة الذروة.", "حل شرحك المفصل المشكلة الحالية وعلمني كيف أخطط في المرة القادمة."],
  },
  hi: {
    intermediate: ["आज दोपहर वहाँ मेरी मुलाकात तय है।", "मैंने नक्शा देखा, लेकिन मुझे वह अभी तक नहीं मिला।", "मैं दोपहर से पहले पहुँचना चाहता हूँ।", "अगर पैदल जाना बहुत दूर है, तो मैं बस ले सकता हूँ।", "मुझे सप्ताहांत के खुलने का समय पक्का करना है।", "आज के कार्यक्रम में यह सबसे महत्वपूर्ण पड़ाव है।", "मेरे पास सामान है, इसलिए मुझे सबसे आसान रास्ता चाहिए।", "पहुँचने के बाद हम सही जगह की पुष्टि कर सकते हैं।", "मुझे कतार के लिए भी समय रखना होगा।", "आपके निर्देशों से मैं आज की योजना पूरी कर सका।"],
    advanced: ["क्योंकि मेरा कार्यक्रम बदल सकता है, कृपया एक वैकल्पिक रास्ता भी समझाइए।", "हालाँकि नक्शा बताता है कि मैं पहुँच गया हूँ, प्रवेश द्वार दूसरी सड़क पर लगता है।", "सबसे तेज़ और सबसे सुविधाजनक रास्तों की तुलना करके दोनों का समय बताइए।", "यदि सार्वजनिक परिवहन बंद हो जाए, तो उपलब्ध भरोसेमंद विकल्प बताइए।", "मैं पुष्टि करना चाहता हूँ कि छुट्टी का समय मेरी बुक की हुई सेवा को प्रभावित तो नहीं करेगा।", "इस पड़ाव से आगे की यात्रा प्रभावित होगी, इसलिए मुझे सही पहुँचने का समय चाहिए।", "सुलभता और सामान को ध्यान में रखकर सबसे कम बदलाव वाला रास्ता सुझाइए।", "यदि हम अलग-अलग जाएँ, तो आसानी से पहचाना जाने वाला मिलने का स्थान सुझाइए।", "सामान्य यात्रा समय के अलावा मैं जानना चाहता हूँ कि व्यस्त समय में कितना अतिरिक्त समय रखना चाहिए।", "आपकी विस्तृत जानकारी ने अभी की समस्या हल की और अगली बार की योजना बनाना भी सिखाया।"],
  },
};

function levelSentence(sentence: string, level: SmartLingoLevel, language: SmartLingoLearningLanguage, index: number) {
  if (level === "beginner") return sentence;
  return `${sentence} ${LEVEL_EXTENSIONS[language][level][index]}`;
}

const LEVEL_METADATA = {
  beginner: { cefrBand: "A1-aligned", difficulty: 1 },
  intermediate: { cefrBand: "A2-B1-aligned", difficulty: 3 },
  advanced: { cefrBand: "B1+-B2-aligned", difficulty: 5 },
} as const;

const FUNCTION_IDS = ["locate", "search", "directions", "distance", "hours", "need", "transport", "meeting", "duration", "gratitude"] as const;

export type SmartLingoSentenceExercise = {
  id: string;
  contentVersion: typeof SMARTLINGO_SENTENCE_CONTENT_VERSION;
  language: SmartLingoLearningLanguage;
  level: SmartLingoLevel;
  cefrBand: "A1-aligned" | "A2-B1-aligned" | "B1+-B2-aligned";
  difficulty: 1 | 3 | 5;
  frequencyDegree: number;
  sequence: number;
  scenario: string;
  functionId: (typeof FUNCTION_IDS)[number];
  targetSentence: string;
  translation: { zh: string; en: string };
  anchorVocabulary: string;
};

export function buildCourseSentenceBank(language: SmartLingoLearningLanguage, level: SmartLingoLevel): readonly SmartLingoSentenceExercise[] {
  const rows = SCENARIOS.flatMap((scenario, scenarioIndex) => {
    const targets = TARGET_BUILDERS[language](scenario.places[language]);
    const chinese = CHINESE_BUILD(scenario.zh);
    const english = ENGLISH_BUILD(scenario.en);
    return targets.map((targetSentence, index) => ({
      id: `sentence:${SMARTLINGO_SENTENCE_CONTENT_VERSION}:${language}:${level}:${scenario.id}:${index + 1}`,
      contentVersion: SMARTLINGO_SENTENCE_CONTENT_VERSION,
      language,
      level,
      ...LEVEL_METADATA[level],
      frequencyDegree: 10 - index,
      sequence: scenarioIndex * 10 + index + 1,
      scenario: scenario.id,
      functionId: FUNCTION_IDS[index],
      targetSentence: levelSentence(targetSentence, level, language, index),
      translation: {
        zh: levelSentence(chinese[index], level, "zh", index),
        en: levelSentence(english[index], level, "en", index),
      },
      anchorVocabulary: scenario.places[language],
    }));
  });
  if (rows.length !== SMARTLINGO_SENTENCES_PER_COURSE) throw new Error("Each SmartLingo course must contain exactly 120 sentence exercises");
  return rows;
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function buildDailySentenceRound(language: SmartLingoLearningLanguage, level: SmartLingoLevel, date: string, skill: "listening" | "writing") {
  const bank = buildCourseSentenceBank(language, level);
  const offset = stableHash(`${date}:${language}:${level}:${skill}:${SMARTLINGO_SENTENCE_CONTENT_VERSION}`) % bank.length;
  const stride = 37;
  return Array.from({ length: SMARTLINGO_SENTENCES_PER_ROUND }, (_, index) => bank[(offset + index * stride) % bank.length]);
}

export function tokenizeSentence(sentence: string, language: SmartLingoLearningLanguage | SmartLingoInterfaceLanguage) {
  const segmenter = new Intl.Segmenter(language, { granularity: "word" });
  return [...segmenter.segment(sentence)].filter(part => part.isWordLike).map(part => part.segment);
}

export function normalizeSentenceAnswer(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[\p{P}\p{S}\s]+/gu, "");
}

export function gradeSentenceRound(expected: readonly SmartLingoSentenceExercise[], answer: string | null | undefined, skill: "listening" | "writing", uiLang: SmartLingoInterfaceLanguage) {
  let responses: unknown = [];
  try { responses = JSON.parse(answer || "[]"); } catch { responses = []; }
  const answers = Array.isArray(responses) ? responses.map(value => String(value)) : [];
  const scores = expected.map((exercise, index) => {
    const expectedAnswer = exercise.targetSentence;
    return normalizeSentenceAnswer(answers[index] || "") === normalizeSentenceAnswer(expectedAnswer) ? 100 : 0;
  });
  return {
    skill,
    score: Math.round(scores.reduce<number>((sum, score) => sum + score, 0) / Math.max(1, expected.length)),
    correctCount: scores.filter(score => score === 100).length,
    questionCount: expected.length,
    uiLang,
  };
}
