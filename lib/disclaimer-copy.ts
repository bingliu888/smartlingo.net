export const DISCLAIMER_LOCALES = [
  "zh", "en", "es", "ja", "ko", "fr", "de", "ru", "it", "pt", "ar", "hi",
  "id", "bn", "ur", "pa", "ta", "te", "ne", "si", "tr",
] as const;

export type DisclaimerLocale = (typeof DISCLAIMER_LOCALES)[number];
export type DisclaimerCopy = {
  label: string;
  eyebrow: string;
  title: string;
  intro: string;
  sections: readonly (readonly [string, string])[];
};

const copies: Record<DisclaimerLocale, DisclaimerCopy> = {
  en: {
    label: "Disclaimer", eyebrow: "DISCLAIMER", title: "Important information about this site and its services.",
    intro: "Effective August 24, 2026. Please read this notice before relying on content, using third-party services, or making a payment.",
    sections: [
      ["AI-assisted service", "This site uses artificial intelligence tools to help design, build, operate, translate, summarize, and create content. AI-assisted or human-reviewed material may still be incomplete, outdated, or wrong."],
      ["Accuracy and pricing errors", "We do not guarantee the accuracy, completeness, availability, or timeliness of any content, including prices, fees, offers, product details, exchange rates, or market data. Verify important information before acting or paying. A published error does not create a binding obligation, and we may correct it."],
      ["Third-party platforms", "X, Facebook, TikTok, wallet applications, crypto exchanges, protocols, and other linked or mentioned services are independent third parties. A reference or link is not an endorsement. Their own terms, privacy rules, availability, and risks apply."],
      ["Crypto and financial risk", "Content is general information, not investment, financial, legal, or tax advice. Digital assets are volatile, and blockchain transactions can be irreversible. Verify the recipient, address, network, token, amount, fees, and legal requirements before proceeding. You are responsible for your decisions and account security."],
      ["Final and non-refundable payments", "All payments are final and non-refundable, except where applicable law requires otherwise. Confirm the final price, currency or token, network, recipient, and purchase terms before paying. We do not refund changes of mind, market movements, user mistakes, or third-party charges. We may reject or cancel an uncompleted order affected by an obvious pricing or listing error."],
      ["No warranty and limitation of liability", "To the fullest extent permitted by law, the site and its operators provide the service as available, without warranties, and are not liable for losses caused by reliance on inaccurate content, service interruptions, third parties, digital assets, network events, or unauthorized account activity. Rights that cannot legally be excluded remain unaffected."],
    ],
  },
  zh: {
    label: "免责声明", eyebrow: "免责声明", title: "关于本网站及其服务的重要说明。",
    intro: "生效日期：2026 年 8 月 24 日。在依赖网站内容、使用第三方服务或付款前，请阅读本说明。",
    sections: [
      ["人工智能辅助服务", "本网站使用人工智能工具协助设计、开发、运营、翻译、摘要和内容生成。即使经过人工审核，相关内容仍可能不完整、过时或有误。"],
      ["准确性与价格错误", "我们不保证任何内容的准确性、完整性、可用性或时效性，包括价格、费用、优惠、产品资料、汇率和市场数据。采取行动或付款前，请自行核实重要信息。发布错误不构成约束性承诺，我们有权更正。"],
      ["第三方平台", "X、Facebook、TikTok、钱包应用、加密货币交易所、协议以及其他链接或提及的服务均为独立第三方。引用或链接不代表认可；其自身条款、隐私规则、可用性和风险由相应第三方负责。"],
      ["加密资产与金融风险", "网站内容仅为一般信息，不构成投资、财务、法律或税务建议。数字资产价格可能剧烈波动，区块链交易可能无法撤销。操作前请核对收款方、地址、网络、代币、金额、费用及法律要求。您应对自己的决定和账户安全负责。"],
      ["付款最终且不可退款", "除适用法律另有强制要求外，所有付款均为最终付款且不可退款。付款前请确认最终价格、货币或代币、网络、收款方和购买条款。因改变主意、市场波动、用户操作错误或第三方费用产生的款项不予退还。对于明显价格或刊登错误影响且尚未完成的订单，我们可以拒绝或取消。"],
      ["不作保证与责任限制", "在法律允许的最大范围内，本网站及其运营方按现状和可用状态提供服务，不作任何保证，也不对因依赖不准确信息、服务中断、第三方、数字资产、网络事件或未经授权的账户活动造成的损失承担责任。依法不得排除的权利不受影响。"],
    ],
  },
  es: {
    label: "Aviso legal", eyebrow: "AVISO LEGAL", title: "Información importante sobre este sitio y sus servicios.",
    intro: "Vigente desde el 24 de agosto de 2026. Lea este aviso antes de confiar en el contenido, usar servicios de terceros o realizar un pago.",
    sections: [
      ["Servicio asistido por IA", "Este sitio usa herramientas de inteligencia artificial para ayudar a diseñar, desarrollar, operar, traducir, resumir y crear contenido. El material asistido por IA o revisado por personas aún puede estar incompleto, desactualizado o ser incorrecto."],
      ["Exactitud y errores de precio", "No garantizamos la exactitud, integridad, disponibilidad ni actualidad de ningún contenido, incluidos precios, tarifas, ofertas, detalles de productos, tipos de cambio o datos de mercado. Verifique la información importante antes de actuar o pagar. Un error publicado no crea una obligación vinculante y puede corregirse."],
      ["Plataformas de terceros", "X, Facebook, TikTok, aplicaciones de cartera, bolsas de criptomonedas, protocolos y otros servicios enlazados o mencionados son terceros independientes. Una referencia o enlace no implica respaldo; se aplican sus propios términos, privacidad, disponibilidad y riesgos."],
      ["Riesgo cripto y financiero", "El contenido es información general, no asesoramiento de inversión, financiero, legal o fiscal. Los activos digitales son volátiles y las transacciones de cadena de bloques pueden ser irreversibles. Verifique destinatario, dirección, red, token, importe, comisiones y requisitos legales. Usted responde por sus decisiones y la seguridad de su cuenta."],
      ["Pagos finales y no reembolsables", "Todos los pagos son finales y no reembolsables, salvo cuando la ley aplicable exija lo contrario. Confirme precio final, moneda o token, red, destinatario y condiciones antes de pagar. No se reembolsan cambios de opinión, movimientos del mercado, errores del usuario ni cargos de terceros. Podemos rechazar o cancelar una orden no completada afectada por un error evidente de precio o publicación."],
      ["Sin garantía y límite de responsabilidad", "En la máxima medida permitida por la ley, el sitio y sus operadores prestan el servicio según disponibilidad, sin garantías, y no responden por pérdidas derivadas de contenido inexacto, interrupciones, terceros, activos digitales, eventos de red o actividad no autorizada. Los derechos que legalmente no puedan excluirse permanecen vigentes."],
    ],
  },
  ja: {
    label: "免責事項", eyebrow: "免責事項", title: "本サイトとサービスに関する重要なお知らせ。",
    intro: "発効日：2026年8月24日。コンテンツを信頼する、第三者サービスを利用する、または支払いを行う前にお読みください。",
    sections: [
      ["AI 支援サービス", "本サイトは、設計、開発、運営、翻訳、要約、コンテンツ作成を補助するために AI ツールを使用しています。AI 支援または人による確認済みの資料でも、不完全、古い、または誤っている場合があります。"],
      ["正確性と価格の誤り", "価格、手数料、オファー、商品情報、為替レート、市場データを含む情報の正確性、完全性、利用可能性、最新性を保証しません。行動または支払いの前に重要情報を確認してください。掲載上の誤りは拘束力ある義務を生じさせず、当方は訂正できます。"],
      ["第三者プラットフォーム", "X、Facebook、TikTok、ウォレットアプリ、暗号資産取引所、プロトコル、その他リンクまたは言及されたサービスは独立した第三者です。参照やリンクは推奨を意味せず、各社の規約、プライバシー方針、可用性、リスクが適用されます。"],
      ["暗号資産と金融リスク", "コンテンツは一般情報であり、投資、金融、法律、税務の助言ではありません。デジタル資産は価格変動が大きく、ブロックチェーン取引は取り消せない場合があります。受取人、アドレス、ネットワーク、トークン、金額、手数料、法的要件を確認してください。判断とアカウント保護は利用者の責任です。"],
      ["支払いは確定・返金不可", "適用法が別途義務付ける場合を除き、すべての支払いは確定し返金されません。支払い前に最終価格、通貨またはトークン、ネットワーク、受取人、購入条件を確認してください。心変わり、市場変動、利用者の誤操作、第三者手数料は返金対象外です。明白な価格または掲載ミスの影響を受けた未完了注文は拒否または取消しできます。"],
      ["無保証と責任制限", "法令で認められる最大限の範囲で、本サイトと運営者はサービスを現状かつ提供可能な状態で保証なく提供し、不正確な情報への依存、停止、第三者、デジタル資産、ネットワーク事象、不正なアカウント利用による損失に責任を負いません。法的に排除できない権利は維持されます。"],
    ],
  },
  ko: {
    label: "면책 고지", eyebrow: "면책 고지", title: "이 사이트와 서비스에 관한 중요 안내입니다.",
    intro: "시행일: 2026년 8월 24일. 콘텐츠를 신뢰하거나 제3자 서비스를 이용하거나 결제하기 전에 읽어 주십시오.",
    sections: [
      ["AI 보조 서비스", "이 사이트는 설계, 개발, 운영, 번역, 요약 및 콘텐츠 제작을 돕기 위해 AI 도구를 사용합니다. AI가 지원했거나 사람이 검토한 자료도 불완전하거나 오래되었거나 잘못될 수 있습니다."],
      ["정확성 및 가격 오류", "가격, 수수료, 제안, 제품 정보, 환율 또는 시장 데이터를 포함한 콘텐츠의 정확성, 완전성, 가용성 또는 적시성을 보장하지 않습니다. 행동하거나 결제하기 전에 중요한 정보를 확인하십시오. 게시 오류는 구속력 있는 의무를 만들지 않으며 수정될 수 있습니다."],
      ["제3자 플랫폼", "X, Facebook, TikTok, 지갑 앱, 암호화폐 거래소, 프로토콜 및 링크되거나 언급된 기타 서비스는 독립된 제3자입니다. 참조나 링크는 보증을 뜻하지 않으며 각 서비스의 약관, 개인정보 규칙, 가용성 및 위험이 적용됩니다."],
      ["암호화폐 및 금융 위험", "콘텐츠는 일반 정보이며 투자, 금융, 법률 또는 세무 조언이 아닙니다. 디지털 자산은 변동성이 크고 블록체인 거래는 되돌릴 수 없을 수 있습니다. 수취인, 주소, 네트워크, 토큰, 금액, 수수료 및 법적 요건을 확인하십시오. 결정과 계정 보안은 이용자 책임입니다."],
      ["최종 결제 및 환불 불가", "관련 법률이 달리 요구하지 않는 한 모든 결제는 최종적이며 환불되지 않습니다. 결제 전에 최종 가격, 통화 또는 토큰, 네트워크, 수취인 및 구매 조건을 확인하십시오. 단순 변심, 시장 변동, 이용자 실수 또는 제3자 비용은 환불되지 않습니다. 명백한 가격 또는 게시 오류가 있는 미완료 주문은 거절하거나 취소할 수 있습니다."],
      ["보증 부인 및 책임 제한", "법이 허용하는 최대 범위에서 사이트와 운영자는 서비스를 제공 가능한 상태 그대로 보증 없이 제공하며, 부정확한 콘텐츠 의존, 서비스 중단, 제3자, 디지털 자산, 네트워크 사건 또는 무단 계정 활동으로 인한 손실에 책임지지 않습니다. 법적으로 배제할 수 없는 권리는 유지됩니다."],
    ],
  },
  fr: {
    label: "Avertissement", eyebrow: "AVERTISSEMENT", title: "Informations importantes sur ce site et ses services.",
    intro: "En vigueur le 24 août 2026. Lisez cet avis avant de vous fier au contenu, d’utiliser un service tiers ou d’effectuer un paiement.",
    sections: [
      ["Service assisté par l’IA", "Ce site utilise des outils d’intelligence artificielle pour aider à concevoir, développer, exploiter, traduire, résumer et créer du contenu. Un contenu assisté par l’IA ou relu par une personne peut rester incomplet, obsolète ou erroné."],
      ["Exactitude et erreurs de prix", "Nous ne garantissons ni l’exactitude, ni l’exhaustivité, ni la disponibilité, ni l’actualité du contenu, notamment des prix, frais, offres, détails de produits, taux de change ou données de marché. Vérifiez les informations importantes avant d’agir ou de payer. Une erreur publiée ne crée pas d’obligation contraignante et peut être corrigée."],
      ["Plateformes tierces", "X, Facebook, TikTok, les applications de portefeuille, plateformes d’échange de cryptoactifs, protocoles et autres services cités ou liés sont des tiers indépendants. Une référence ou un lien ne vaut pas approbation; leurs conditions, règles de confidentialité, disponibilité et risques s’appliquent."],
      ["Risques crypto et financiers", "Le contenu est une information générale et non un conseil d’investissement, financier, juridique ou fiscal. Les actifs numériques sont volatils et les transactions blockchain peuvent être irréversibles. Vérifiez le destinataire, l’adresse, le réseau, le jeton, le montant, les frais et les exigences légales. Vous êtes responsable de vos décisions et de la sécurité de votre compte."],
      ["Paiements définitifs et non remboursables", "Tous les paiements sont définitifs et non remboursables, sauf obligation contraire de la loi applicable. Confirmez le prix final, la devise ou le jeton, le réseau, le destinataire et les conditions avant de payer. Aucun remboursement n’est dû pour un changement d’avis, une variation de marché, une erreur de l’utilisateur ou des frais tiers. Une commande non finalisée touchée par une erreur manifeste de prix ou d’annonce peut être refusée ou annulée."],
      ["Absence de garantie et limitation", "Dans toute la mesure permise par la loi, le site et ses exploitants fournissent le service selon disponibilité, sans garantie, et ne répondent pas des pertes liées à un contenu inexact, une interruption, un tiers, un actif numérique, un événement réseau ou une activité de compte non autorisée. Les droits légalement non exclus restent intacts."],
    ],
  },
  de: {
    label: "Haftungsausschluss", eyebrow: "HAFTUNGSAUSSCHLUSS", title: "Wichtige Informationen über diese Website und ihre Dienste.",
    intro: "Gültig ab 24. August 2026. Bitte lesen Sie diesen Hinweis, bevor Sie sich auf Inhalte verlassen, Dienste Dritter nutzen oder bezahlen.",
    sections: [
      ["KI-unterstützter Dienst", "Diese Website nutzt KI-Werkzeuge zur Unterstützung bei Gestaltung, Entwicklung, Betrieb, Übersetzung, Zusammenfassung und Inhaltserstellung. Auch KI-unterstützte oder menschlich geprüfte Inhalte können unvollständig, veraltet oder falsch sein."],
      ["Richtigkeit und Preisfehler", "Wir garantieren nicht die Richtigkeit, Vollständigkeit, Verfügbarkeit oder Aktualität von Inhalten, einschließlich Preisen, Gebühren, Angeboten, Produktdetails, Wechselkursen oder Marktdaten. Prüfen Sie wichtige Angaben vor einer Handlung oder Zahlung. Ein veröffentlichter Fehler begründet keine bindende Verpflichtung und kann berichtigt werden."],
      ["Drittplattformen", "X, Facebook, TikTok, Wallet-Apps, Kryptobörsen, Protokolle und andere verlinkte oder erwähnte Dienste sind unabhängige Dritte. Eine Erwähnung oder Verlinkung ist keine Empfehlung; es gelten deren Bedingungen, Datenschutzregeln, Verfügbarkeit und Risiken."],
      ["Krypto- und Finanzrisiko", "Inhalte sind allgemeine Informationen und keine Anlage-, Finanz-, Rechts- oder Steuerberatung. Digitale Vermögenswerte sind volatil und Blockchain-Transaktionen können unumkehrbar sein. Prüfen Sie Empfänger, Adresse, Netzwerk, Token, Betrag, Gebühren und rechtliche Anforderungen. Sie sind für Entscheidungen und Kontosicherheit verantwortlich."],
      ["Endgültige, nicht erstattbare Zahlungen", "Alle Zahlungen sind endgültig und nicht erstattbar, soweit das anwendbare Recht nichts anderes verlangt. Prüfen Sie Endpreis, Währung oder Token, Netzwerk, Empfänger und Kaufbedingungen. Keine Erstattung erfolgt bei Meinungsänderung, Marktbewegungen, Nutzerfehlern oder Drittgebühren. Eine nicht abgeschlossene Bestellung mit offensichtlichem Preis- oder Angebotsfehler kann abgelehnt oder storniert werden."],
      ["Keine Gewährleistung und Haftungsbegrenzung", "Soweit gesetzlich zulässig, stellen Website und Betreiber den Dienst wie verfügbar ohne Gewähr bereit und haften nicht für Verluste durch unrichtige Inhalte, Unterbrechungen, Dritte, digitale Vermögenswerte, Netzwerkereignisse oder unbefugte Kontonutzung. Gesetzlich nicht ausschließbare Rechte bleiben unberührt."],
    ],
  },
  ru: {
    label: "Отказ от ответственности", eyebrow: "ОТКАЗ ОТ ОТВЕТСТВЕННОСТИ", title: "Важная информация о сайте и его услугах.",
    intro: "Действует с 24 августа 2026 года. Прочитайте уведомление, прежде чем полагаться на материалы, пользоваться сторонними сервисами или платить.",
    sections: [
      ["Сервис с поддержкой ИИ", "Сайт использует инструменты искусственного интеллекта для проектирования, разработки, эксплуатации, перевода, обобщения и создания материалов. Даже проверенные человеком или созданные с помощью ИИ материалы могут быть неполными, устаревшими или ошибочными."],
      ["Точность и ошибки цен", "Мы не гарантируем точность, полноту, доступность или актуальность материалов, включая цены, комиссии, предложения, сведения о товарах, курсы валют и рыночные данные. Проверяйте важные сведения до действий или оплаты. Опубликованная ошибка не создаёт обязательства и может быть исправлена."],
      ["Сторонние платформы", "X, Facebook, TikTok, приложения-кошельки, криптобиржи, протоколы и иные упомянутые или связанные сервисы являются независимыми третьими сторонами. Ссылка не означает одобрения; действуют их условия, правила конфиденциальности, доступность и риски."],
      ["Крипто- и финансовые риски", "Материалы носят общий характер и не являются инвестиционной, финансовой, юридической или налоговой консультацией. Цифровые активы волатильны, а блокчейн-транзакции могут быть необратимыми. Проверяйте получателя, адрес, сеть, токен, сумму, комиссии и требования закона. Вы отвечаете за решения и безопасность аккаунта."],
      ["Окончательные и невозвратные платежи", "Все платежи окончательны и не подлежат возврату, кроме случаев, когда применимое право требует иного. До оплаты подтвердите итоговую цену, валюту или токен, сеть, получателя и условия. Возврат не производится из-за изменения решения, движения рынка, ошибки пользователя или сторонних сборов. Незавершённый заказ с очевидной ошибкой цены или публикации может быть отклонён или отменён."],
      ["Отсутствие гарантий и ограничение ответственности", "В максимальной степени, разрешённой законом, сайт и операторы предоставляют сервис по мере доступности без гарантий и не отвечают за потери из-за неточных материалов, перерывов, третьих сторон, цифровых активов, сетевых событий или несанкционированной активности. Права, которые нельзя исключить законом, сохраняются."],
    ],
  },
  it: {
    label: "Esclusione di responsabilità", eyebrow: "ESCLUSIONE DI RESPONSABILITÀ", title: "Informazioni importanti su questo sito e sui suoi servizi.",
    intro: "In vigore dal 24 agosto 2026. Leggere prima di fare affidamento sui contenuti, usare servizi di terzi o effettuare un pagamento.",
    sections: [
      ["Servizio assistito dall’IA", "Il sito usa strumenti di intelligenza artificiale per progettazione, sviluppo, gestione, traduzione, sintesi e creazione di contenuti. Anche il materiale assistito dall’IA o revisionato da persone può essere incompleto, obsoleto o errato."],
      ["Accuratezza ed errori di prezzo", "Non garantiamo accuratezza, completezza, disponibilità o tempestività dei contenuti, inclusi prezzi, commissioni, offerte, dettagli dei prodotti, tassi di cambio o dati di mercato. Verificare le informazioni importanti prima di agire o pagare. Un errore pubblicato non crea un obbligo vincolante e può essere corretto."],
      ["Piattaforme di terzi", "X, Facebook, TikTok, app wallet, exchange di criptovalute, protocolli e altri servizi citati o collegati sono terzi indipendenti. Un riferimento o link non costituisce approvazione; valgono i loro termini, regole privacy, disponibilità e rischi."],
      ["Rischi cripto e finanziari", "I contenuti sono informazioni generali, non consulenza d’investimento, finanziaria, legale o fiscale. Gli asset digitali sono volatili e le transazioni blockchain possono essere irreversibili. Verificare destinatario, indirizzo, rete, token, importo, commissioni e requisiti legali. Le decisioni e la sicurezza dell’account sono responsabilità dell’utente."],
      ["Pagamenti definitivi e non rimborsabili", "Tutti i pagamenti sono definitivi e non rimborsabili, salvo diverso obbligo di legge. Confermare prezzo finale, valuta o token, rete, destinatario e condizioni prima di pagare. Non sono previsti rimborsi per ripensamenti, movimenti di mercato, errori dell’utente o costi di terzi. Un ordine non completato con evidente errore di prezzo o inserzione può essere rifiutato o annullato."],
      ["Nessuna garanzia e limite di responsabilità", "Nella misura massima consentita dalla legge, sito e gestori forniscono il servizio secondo disponibilità, senza garanzie, e non rispondono di perdite dovute a contenuti inesatti, interruzioni, terzi, asset digitali, eventi di rete o attività non autorizzate. Restano salvi i diritti non escludibili per legge."],
    ],
  },
  pt: {
    label: "Aviso de isenção", eyebrow: "AVISO DE ISENÇÃO", title: "Informações importantes sobre este site e seus serviços.",
    intro: "Vigente em 24 de agosto de 2026. Leia antes de confiar no conteúdo, usar serviços de terceiros ou fazer um pagamento.",
    sections: [
      ["Serviço com assistência de IA", "O site usa ferramentas de inteligência artificial para auxiliar no design, desenvolvimento, operação, tradução, resumo e criação de conteúdo. Mesmo materiais assistidos por IA ou revisados por pessoas podem estar incompletos, desatualizados ou errados."],
      ["Precisão e erros de preço", "Não garantimos precisão, integridade, disponibilidade ou atualidade de qualquer conteúdo, incluindo preços, taxas, ofertas, detalhes de produtos, câmbio ou dados de mercado. Verifique informações importantes antes de agir ou pagar. Um erro publicado não cria obrigação vinculante e pode ser corrigido."],
      ["Plataformas de terceiros", "X, Facebook, TikTok, aplicativos de carteira, corretoras de cripto, protocolos e outros serviços mencionados ou vinculados são terceiros independentes. Referência ou link não significa endosso; aplicam-se seus próprios termos, privacidade, disponibilidade e riscos."],
      ["Risco cripto e financeiro", "O conteúdo é informação geral, não aconselhamento de investimento, financeiro, jurídico ou tributário. Ativos digitais são voláteis e transações em blockchain podem ser irreversíveis. Confira destinatário, endereço, rede, token, valor, taxas e exigências legais. Você responde por suas decisões e segurança da conta."],
      ["Pagamentos finais e não reembolsáveis", "Todos os pagamentos são finais e não reembolsáveis, salvo quando a lei aplicável exigir o contrário. Confirme preço final, moeda ou token, rede, destinatário e termos antes de pagar. Não há reembolso por mudança de ideia, oscilação de mercado, erro do usuário ou cobrança de terceiros. Um pedido não concluído afetado por erro evidente de preço ou anúncio pode ser recusado ou cancelado."],
      ["Sem garantia e limitação de responsabilidade", "Na máxima extensão permitida por lei, site e operadores fornecem o serviço conforme disponível, sem garantias, e não respondem por perdas causadas por conteúdo impreciso, interrupções, terceiros, ativos digitais, eventos de rede ou atividade não autorizada. Direitos que não podem ser excluídos permanecem válidos."],
    ],
  },
  ar: {
    label: "إخلاء المسؤولية", eyebrow: "إخلاء المسؤولية", title: "معلومات مهمة حول هذا الموقع وخدماته.",
    intro: "ساري المفعول في 24 أغسطس 2026. يُرجى قراءة هذا الإشعار قبل الاعتماد على المحتوى أو استخدام خدمات خارجية أو إجراء أي دفعة.",
    sections: [
      ["خدمة بمساعدة الذكاء الاصطناعي", "يستخدم الموقع أدوات الذكاء الاصطناعي للمساعدة في التصميم والتطوير والتشغيل والترجمة والتلخيص وإنشاء المحتوى. وقد تظل المواد المدعومة بالذكاء الاصطناعي أو المراجعة بشرياً ناقصة أو قديمة أو خاطئة."],
      ["الدقة وأخطاء الأسعار", "لا نضمن دقة أو اكتمال أو توافر أو حداثة أي محتوى، بما في ذلك الأسعار والرسوم والعروض وتفاصيل المنتجات وأسعار الصرف وبيانات السوق. تحقّق من المعلومات المهمة قبل التصرف أو الدفع. لا ينشئ الخطأ المنشور التزاماً ملزماً ويجوز تصحيحه."],
      ["منصات الأطراف الثالثة", "تُعد X وFacebook وTikTok وتطبيقات المحافظ ومنصات تداول العملات المشفرة والبروتوكولات والخدمات الأخرى المذكورة أو المرتبطة أطرافاً مستقلة. لا تعني الإشارة أو الرابط المصادقة؛ وتطبق شروطها وخصوصيتها وتوافرها ومخاطرها."],
      ["مخاطر العملات المشفرة والمال", "المحتوى معلومات عامة وليس نصيحة استثمارية أو مالية أو قانونية أو ضريبية. الأصول الرقمية متقلبة وقد تكون معاملات البلوك تشين غير قابلة للعكس. تحقّق من المستلم والعنوان والشبكة والرمز والمبلغ والرسوم والمتطلبات القانونية. أنت مسؤول عن قراراتك وأمان حسابك."],
      ["دفعات نهائية وغير قابلة للاسترداد", "جميع الدفعات نهائية وغير قابلة للاسترداد، إلا إذا أوجب القانون المعمول به خلاف ذلك. أكّد السعر النهائي والعملة أو الرمز والشبكة والمستلم والشروط قبل الدفع. لا استرداد بسبب تغيير الرأي أو حركة السوق أو خطأ المستخدم أو رسوم الطرف الثالث. يجوز رفض أو إلغاء طلب غير مكتمل تأثر بخطأ واضح في السعر أو الإدراج."],
      ["عدم الضمان وتحديد المسؤولية", "إلى أقصى حد يسمح به القانون، يقدم الموقع ومشغلوه الخدمة حسب توافرها دون ضمانات، ولا يتحملون خسائر ناتجة عن محتوى غير دقيق أو انقطاع أو أطراف ثالثة أو أصول رقمية أو أحداث الشبكة أو نشاط غير مصرح به. تبقى الحقوق التي لا يمكن استبعادها قانوناً سارية."],
    ],
  },
  hi: {
    label: "अस्वीकरण", eyebrow: "अस्वीकरण", title: "इस साइट और इसकी सेवाओं के बारे में महत्वपूर्ण जानकारी।",
    intro: "प्रभावी तिथि: 24 अगस्त 2026। सामग्री पर भरोसा करने, तृतीय-पक्ष सेवा उपयोग करने या भुगतान करने से पहले इसे पढ़ें।",
    sections: [
      ["AI-सहायित सेवा", "यह साइट डिज़ाइन, विकास, संचालन, अनुवाद, सारांश और सामग्री निर्माण में सहायता के लिए कृत्रिम बुद्धिमत्ता उपकरणों का उपयोग करती है। AI-सहायित या मानव-समीक्षित सामग्री भी अधूरी, पुरानी या गलत हो सकती है।"],
      ["सटीकता और मूल्य त्रुटियाँ", "हम कीमत, शुल्क, ऑफ़र, उत्पाद विवरण, विनिमय दर या बाज़ार डेटा सहित किसी सामग्री की सटीकता, पूर्णता, उपलब्धता या समयबद्धता की गारंटी नहीं देते। कार्य या भुगतान से पहले महत्वपूर्ण जानकारी जाँचें। प्रकाशित त्रुटि बाध्यकारी दायित्व नहीं बनाती और उसे सुधारा जा सकता है।"],
      ["तृतीय-पक्ष प्लेटफ़ॉर्म", "X, Facebook, TikTok, वॉलेट ऐप, क्रिप्टो एक्सचेंज, प्रोटोकॉल और अन्य लिंक या उल्लिखित सेवाएँ स्वतंत्र तृतीय पक्ष हैं। संदर्भ या लिंक समर्थन नहीं है; उनके अपने नियम, गोपनीयता, उपलब्धता और जोखिम लागू होते हैं।"],
      ["क्रिप्टो और वित्तीय जोखिम", "सामग्री सामान्य जानकारी है, निवेश, वित्तीय, कानूनी या कर सलाह नहीं। डिजिटल परिसंपत्तियाँ अस्थिर हैं और ब्लॉकचेन लेनदेन अपरिवर्तनीय हो सकते हैं। प्राप्तकर्ता, पता, नेटवर्क, टोकन, राशि, शुल्क और कानूनी आवश्यकताएँ जाँचें। निर्णय और खाते की सुरक्षा आपकी जिम्मेदारी है।"],
      ["अंतिम और गैर-वापसीयोग्य भुगतान", "लागू कानून के अन्यथा आवश्यक करने को छोड़कर सभी भुगतान अंतिम और गैर-वापसीयोग्य हैं। भुगतान से पहले अंतिम मूल्य, मुद्रा या टोकन, नेटवर्क, प्राप्तकर्ता और शर्तें जाँचें। मन बदलने, बाज़ार चाल, उपयोगकर्ता त्रुटि या तृतीय-पक्ष शुल्क पर वापसी नहीं होगी। स्पष्ट मूल्य या सूची त्रुटि वाले अधूरे ऑर्डर को अस्वीकार या रद्द किया जा सकता है।"],
      ["कोई वारंटी नहीं और दायित्व सीमा", "कानून द्वारा अनुमत अधिकतम सीमा तक साइट और संचालक सेवा को उपलब्धता के अनुसार बिना वारंटी देते हैं और गलत सामग्री, रुकावट, तृतीय पक्ष, डिजिटल परिसंपत्ति, नेटवर्क घटना या अनधिकृत खाते की गतिविधि से हुई हानि के लिए उत्तरदायी नहीं हैं। कानूनन न हटाए जा सकने वाले अधिकार सुरक्षित रहते हैं।"],
    ],
  },
  id: {
    label: "Penyangkalan", eyebrow: "PENYANGKALAN", title: "Informasi penting tentang situs dan layanannya.",
    intro: "Berlaku 24 Agustus 2026. Bacalah sebelum mengandalkan konten, memakai layanan pihak ketiga, atau melakukan pembayaran.",
    sections: [
      ["Layanan berbantuan AI", "Situs ini memakai alat kecerdasan buatan untuk membantu desain, pengembangan, operasi, penerjemahan, ringkasan, dan pembuatan konten. Materi berbantuan AI atau yang telah ditinjau manusia tetap dapat tidak lengkap, usang, atau salah."],
      ["Akurasi dan kesalahan harga", "Kami tidak menjamin akurasi, kelengkapan, ketersediaan, atau ketepatan waktu konten, termasuk harga, biaya, penawaran, detail produk, kurs, atau data pasar. Verifikasi informasi penting sebelum bertindak atau membayar. Kesalahan yang diterbitkan tidak menciptakan kewajiban mengikat dan dapat diperbaiki."],
      ["Platform pihak ketiga", "X, Facebook, TikTok, aplikasi dompet, bursa kripto, protokol, dan layanan lain yang ditautkan atau disebut adalah pihak ketiga independen. Referensi atau tautan bukan dukungan; syarat, privasi, ketersediaan, dan risikonya sendiri berlaku."],
      ["Risiko kripto dan keuangan", "Konten adalah informasi umum, bukan nasihat investasi, keuangan, hukum, atau pajak. Aset digital bergejolak dan transaksi blockchain dapat tidak dapat dibatalkan. Periksa penerima, alamat, jaringan, token, jumlah, biaya, dan persyaratan hukum. Keputusan dan keamanan akun adalah tanggung jawab Anda."],
      ["Pembayaran final dan tidak dapat dikembalikan", "Semua pembayaran bersifat final dan tidak dapat dikembalikan, kecuali hukum yang berlaku mewajibkan lain. Pastikan harga akhir, mata uang atau token, jaringan, penerima, dan ketentuan sebelum membayar. Tidak ada pengembalian karena berubah pikiran, pergerakan pasar, kesalahan pengguna, atau biaya pihak ketiga. Pesanan yang belum selesai dengan kesalahan harga atau daftar yang jelas dapat ditolak atau dibatalkan."],
      ["Tanpa jaminan dan batas tanggung jawab", "Sejauh diizinkan hukum, situs dan operator menyediakan layanan sebagaimana tersedia tanpa jaminan dan tidak bertanggung jawab atas kerugian karena konten tidak akurat, gangguan, pihak ketiga, aset digital, peristiwa jaringan, atau aktivitas akun tanpa izin. Hak yang tidak dapat dikesampingkan tetap berlaku."],
    ],
  },
  bn: {
    label: "দায়মুক্তি", eyebrow: "দায়মুক্তি", title: "এই সাইট ও এর পরিষেবা সম্পর্কে গুরুত্বপূর্ণ তথ্য।",
    intro: "কার্যকর: ২৪ আগস্ট ২০২৬। বিষয়বস্তুর ওপর নির্ভর, তৃতীয় পক্ষের পরিষেবা ব্যবহার বা অর্থ প্রদানের আগে পড়ুন।",
    sections: [
      ["AI-সহায়িত পরিষেবা", "এই সাইট নকশা, উন্নয়ন, পরিচালনা, অনুবাদ, সারসংক্ষেপ ও বিষয়বস্তু তৈরিতে কৃত্রিম বুদ্ধিমত্তা ব্যবহার করে। AI-সহায়িত বা মানুষের পর্যালোচিত উপাদানও অসম্পূর্ণ, পুরোনো বা ভুল হতে পারে।"],
      ["নির্ভুলতা ও মূল্যগত ত্রুটি", "মূল্য, ফি, অফার, পণ্যের তথ্য, বিনিময় হার বা বাজার তথ্যসহ কোনো বিষয়বস্তুর নির্ভুলতা, সম্পূর্ণতা, প্রাপ্যতা বা সময়োপযোগিতা আমরা নিশ্চিত করি না। কাজ বা অর্থ প্রদানের আগে গুরুত্বপূর্ণ তথ্য যাচাই করুন। প্রকাশিত ভুল বাধ্যতামূলক দায় তৈরি করে না এবং সংশোধন করা যেতে পারে।"],
      ["তৃতীয় পক্ষের প্ল্যাটফর্ম", "X, Facebook, TikTok, ওয়ালেট অ্যাপ, ক্রিপ্টো এক্সচেঞ্জ, প্রোটোকল এবং উল্লেখিত বা লিঙ্ক করা অন্যান্য পরিষেবা স্বাধীন তৃতীয় পক্ষ। উল্লেখ বা লিঙ্ক অনুমোদন নয়; তাদের নিজস্ব শর্ত, গোপনীয়তা, প্রাপ্যতা ও ঝুঁকি প্রযোজ্য।"],
      ["ক্রিপ্টো ও আর্থিক ঝুঁকি", "বিষয়বস্তু সাধারণ তথ্য, বিনিয়োগ, আর্থিক, আইনি বা কর পরামর্শ নয়। ডিজিটাল সম্পদ অস্থির এবং ব্লকচেইন লেনদেন অপরিবর্তনীয় হতে পারে। প্রাপক, ঠিকানা, নেটওয়ার্ক, টোকেন, পরিমাণ, ফি ও আইনি শর্ত যাচাই করুন। সিদ্ধান্ত ও অ্যাকাউন্ট নিরাপত্তা আপনার দায়িত্ব।"],
      ["চূড়ান্ত ও ফেরত অযোগ্য অর্থপ্রদান", "প্রযোজ্য আইন ভিন্নভাবে বাধ্য না করলে সব অর্থপ্রদান চূড়ান্ত ও ফেরত অযোগ্য। মূল্য, মুদ্রা বা টোকেন, নেটওয়ার্ক, প্রাপক ও শর্ত নিশ্চিত করুন। মত পরিবর্তন, বাজার পরিবর্তন, ব্যবহারকারীর ভুল বা তৃতীয় পক্ষের ফি ফেরতযোগ্য নয়। স্পষ্ট মূল্য বা তালিকা ত্রুটিযুক্ত অসম্পূর্ণ অর্ডার প্রত্যাখ্যান বা বাতিল করা যেতে পারে।"],
      ["ওয়ারেন্টি নেই ও দায়সীমা", "আইনে অনুমোদিত সর্বোচ্চ সীমায় সাইট ও অপারেটর প্রাপ্যতা অনুযায়ী কোনো ওয়ারেন্টি ছাড়া পরিষেবা দেয় এবং ভুল বিষয়বস্তু, বিঘ্ন, তৃতীয় পক্ষ, ডিজিটাল সম্পদ, নেটওয়ার্ক ঘটনা বা অননুমোদিত অ্যাকাউন্ট কার্যকলাপের ক্ষতির দায় নেয় না। আইনত বাদ দেওয়া যায় না এমন অধিকার বহাল থাকে।"],
    ],
  },
  ur: {
    label: "دستبرداری", eyebrow: "دستبرداری", title: "اس سائٹ اور اس کی خدمات کے بارے میں اہم معلومات۔",
    intro: "موثر 24 اگست 2026۔ مواد پر انحصار، تیسرے فریق کی خدمت استعمال یا ادائیگی سے پہلے پڑھیں۔",
    sections: [
      ["AI معاون خدمت", "یہ سائٹ ڈیزائن، تیاری، آپریشن، ترجمہ، خلاصہ اور مواد بنانے میں مدد کے لیے مصنوعی ذہانت کے اوزار استعمال کرتی ہے۔ AI معاون یا انسانی جائزہ شدہ مواد بھی نامکمل، پرانا یا غلط ہو سکتا ہے۔"],
      ["درستگی اور قیمت کی غلطیاں", "ہم قیمتوں، فیس، پیشکش، مصنوعات کی تفصیل، شرح مبادلہ یا مارکیٹ ڈیٹا سمیت کسی مواد کی درستگی، تکمیل، دستیابی یا تازگی کی ضمانت نہیں دیتے۔ عمل یا ادائیگی سے پہلے اہم معلومات کی تصدیق کریں۔ شائع شدہ غلطی پابند ذمہ داری پیدا نہیں کرتی اور درست کی جا سکتی ہے۔"],
      ["تیسرے فریق کے پلیٹ فارم", "X، Facebook، TikTok، والٹ ایپس، کرپٹو ایکسچینج، پروٹوکول اور دیگر منسلک یا مذکور خدمات آزاد تیسرے فریق ہیں۔ حوالہ یا لنک توثیق نہیں؛ ان کی شرائط، رازداری، دستیابی اور خطرات لاگو ہوتے ہیں۔"],
      ["کرپٹو اور مالی خطرہ", "مواد عمومی معلومات ہے، سرمایہ کاری، مالی، قانونی یا ٹیکس مشورہ نہیں۔ ڈیجیٹل اثاثے اتار چڑھاؤ رکھتے ہیں اور بلاک چین لین دین ناقابل واپسی ہو سکتا ہے۔ وصول کنندہ، پتہ، نیٹ ورک، ٹوکن، رقم، فیس اور قانونی تقاضے جانچیں۔ فیصلوں اور اکاؤنٹ کی حفاظت آپ کی ذمہ داری ہے۔"],
      ["حتمی اور ناقابل واپسی ادائیگیاں", "قابل اطلاق قانون کے برعکس تقاضے کے سوا تمام ادائیگیاں حتمی اور ناقابل واپسی ہیں۔ ادائیگی سے پہلے آخری قیمت، کرنسی یا ٹوکن، نیٹ ورک، وصول کنندہ اور شرائط کی تصدیق کریں۔ رائے بدلنے، مارکیٹ حرکت، صارف کی غلطی یا تیسرے فریق کی فیس پر واپسی نہیں۔ واضح قیمت یا فہرست کی غلطی والا نامکمل آرڈر رد یا منسوخ ہو سکتا ہے۔"],
      ["کوئی ضمانت نہیں اور ذمہ داری کی حد", "قانون کی اجازت کی حد تک سائٹ اور آپریٹر خدمت دستیابی کے مطابق بغیر ضمانت فراہم کرتے ہیں اور غلط مواد، تعطل، تیسرے فریق، ڈیجیٹل اثاثے، نیٹ ورک واقعات یا غیر مجاز اکاؤنٹ سرگرمی سے نقصان کے ذمہ دار نہیں۔ قانوناً ناقابل اخراج حقوق برقرار ہیں۔"],
    ],
  },
  pa: {
    label: "ਬੇਦਾਅਵਾ", eyebrow: "ਬੇਦਾਅਵਾ", title: "ਇਸ ਸਾਈਟ ਅਤੇ ਇਸ ਦੀਆਂ ਸੇਵਾਵਾਂ ਬਾਰੇ ਮਹੱਤਵਪੂਰਨ ਜਾਣਕਾਰੀ।",
    intro: "ਲਾਗੂ: 24 ਅਗਸਤ 2026। ਸਮੱਗਰੀ ਉੱਤੇ ਭਰੋਸਾ ਕਰਨ, ਤੀਜੀ ਧਿਰ ਦੀ ਸੇਵਾ ਵਰਤਣ ਜਾਂ ਭੁਗਤਾਨ ਤੋਂ ਪਹਿਲਾਂ ਪੜ੍ਹੋ।",
    sections: [
      ["AI-ਸਹਾਇਤ ਸੇਵਾ", "ਇਹ ਸਾਈਟ ਡਿਜ਼ਾਇਨ, ਵਿਕਾਸ, ਚਲਾਉਣ, ਅਨੁਵਾਦ, ਸੰਖੇਪ ਅਤੇ ਸਮੱਗਰੀ ਬਣਾਉਣ ਲਈ AI ਸੰਦ ਵਰਤਦੀ ਹੈ। AI-ਸਹਾਇਤ ਜਾਂ ਮਨੁੱਖੀ ਸਮੀਖਿਆ ਵਾਲੀ ਸਮੱਗਰੀ ਵੀ ਅਧੂਰੀ, ਪੁਰਾਣੀ ਜਾਂ ਗਲਤ ਹੋ ਸਕਦੀ ਹੈ।"],
      ["ਸਹੀਪਨ ਅਤੇ ਕੀਮਤ ਗਲਤੀਆਂ", "ਅਸੀਂ ਕੀਮਤਾਂ, ਫੀਸਾਂ, ਪੇਸ਼ਕਸ਼ਾਂ, ਉਤਪਾਦ ਵੇਰਵਿਆਂ, ਮੁਦਰਾ ਦਰਾਂ ਜਾਂ ਬਾਜ਼ਾਰ ਡਾਟੇ ਸਮੇਤ ਕਿਸੇ ਸਮੱਗਰੀ ਦੀ ਸਹੀਪਨ, ਪੂਰਨਤਾ, ਉਪਲਬਧਤਾ ਜਾਂ ਸਮੇਂਸਿਰਤਾ ਦੀ ਗਾਰੰਟੀ ਨਹੀਂ ਦਿੰਦੇ। ਕਾਰਵਾਈ ਜਾਂ ਭੁਗਤਾਨ ਤੋਂ ਪਹਿਲਾਂ ਜਾਂਚੋ। ਛਪੀ ਗਲਤੀ ਬੱਝਵੀਂ ਜ਼ਿੰਮੇਵਾਰੀ ਨਹੀਂ ਬਣਾਉਂਦੀ ਅਤੇ ਠੀਕ ਕੀਤੀ ਜਾ ਸਕਦੀ ਹੈ।"],
      ["ਤੀਜੀ ਧਿਰ ਪਲੇਟਫਾਰਮ", "X, Facebook, TikTok, ਵਾਲਿਟ ਐਪ, ਕ੍ਰਿਪਟੋ ਐਕਸਚੇਂਜ, ਪ੍ਰੋਟੋਕਾਲ ਅਤੇ ਹੋਰ ਲਿੰਕ ਜਾਂ ਜ਼ਿਕਰ ਕੀਤੀਆਂ ਸੇਵਾਵਾਂ ਸੁਤੰਤਰ ਤੀਜੀਆਂ ਧਿਰਾਂ ਹਨ। ਹਵਾਲਾ ਜਾਂ ਲਿੰਕ ਮਨਜ਼ੂਰੀ ਨਹੀਂ; ਉਹਨਾਂ ਦੀਆਂ ਸ਼ਰਤਾਂ, ਪਰਦੇਦਾਰੀ, ਉਪਲਬਧਤਾ ਅਤੇ ਜੋਖਮ ਲਾਗੂ ਹਨ।"],
      ["ਕ੍ਰਿਪਟੋ ਅਤੇ ਵਿੱਤੀ ਜੋਖਮ", "ਸਮੱਗਰੀ ਆਮ ਜਾਣਕਾਰੀ ਹੈ, ਨਿਵੇਸ਼, ਵਿੱਤੀ, ਕਾਨੂੰਨੀ ਜਾਂ ਟੈਕਸ ਸਲਾਹ ਨਹੀਂ। ਡਿਜ਼ਿਟਲ ਸੰਪਤੀਆਂ ਅਸਥਿਰ ਹਨ ਅਤੇ ਬਲਾਕਚੇਨ ਲੈਣ-ਦੇਣ ਵਾਪਸ ਨਾ ਹੋ ਸਕਦੇ ਹਨ। ਪ੍ਰਾਪਤਕਰਤਾ, ਪਤਾ, ਨੈੱਟਵਰਕ, ਟੋਕਨ, ਰਕਮ, ਫੀਸ ਅਤੇ ਕਾਨੂੰਨੀ ਲੋੜਾਂ ਜਾਂਚੋ। ਫੈਸਲੇ ਅਤੇ ਖਾਤਾ ਸੁਰੱਖਿਆ ਤੁਹਾਡੀ ਜ਼ਿੰਮੇਵਾਰੀ ਹੈ।"],
      ["ਅੰਤਿਮ ਅਤੇ ਨਾ-ਵਾਪਸੀਯੋਗ ਭੁਗਤਾਨ", "ਜਿੱਥੇ ਲਾਗੂ ਕਾਨੂੰਨ ਹੋਰ ਨਾ ਮੰਗੇ, ਸਾਰੇ ਭੁਗਤਾਨ ਅੰਤਿਮ ਅਤੇ ਨਾ-ਵਾਪਸੀਯੋਗ ਹਨ। ਕੀਮਤ, ਮੁਦਰਾ ਜਾਂ ਟੋਕਨ, ਨੈੱਟਵਰਕ, ਪ੍ਰਾਪਤਕਰਤਾ ਅਤੇ ਸ਼ਰਤਾਂ ਦੀ ਪੁਸ਼ਟੀ ਕਰੋ। ਮਨ ਬਦਲਣ, ਬਾਜ਼ਾਰ ਹਿਲਜੁਲ, ਵਰਤੋਂਕਾਰ ਗਲਤੀ ਜਾਂ ਤੀਜੀ ਧਿਰ ਫੀਸ ਲਈ ਵਾਪਸੀ ਨਹੀਂ। ਸਪਸ਼ਟ ਕੀਮਤ ਜਾਂ ਲਿਸਟਿੰਗ ਗਲਤੀ ਵਾਲਾ ਅਧੂਰਾ ਆਰਡਰ ਰੱਦ ਹੋ ਸਕਦਾ ਹੈ।"],
      ["ਕੋਈ ਵਾਰੰਟੀ ਨਹੀਂ ਅਤੇ ਜ਼ਿੰਮੇਵਾਰੀ ਸੀਮਾ", "ਕਾਨੂੰਨ ਦੁਆਰਾ ਮਨਜ਼ੂਰ ਵੱਧ ਤੋਂ ਵੱਧ ਹੱਦ ਤੱਕ ਸਾਈਟ ਅਤੇ ਆਪਰੇਟਰ ਸੇਵਾ ਉਪਲਬਧਤਾ ਅਨੁਸਾਰ ਬਿਨਾਂ ਵਾਰੰਟੀ ਦਿੰਦੇ ਹਨ ਅਤੇ ਗਲਤ ਸਮੱਗਰੀ, ਰੁਕਾਵਟ, ਤੀਜੀ ਧਿਰ, ਡਿਜ਼ਿਟਲ ਸੰਪਤੀ, ਨੈੱਟਵਰਕ ਘਟਨਾ ਜਾਂ ਅਣਅਧਿਕਾਰਤ ਖਾਤਾ ਸਰਗਰਮੀ ਤੋਂ ਨੁਕਸਾਨ ਲਈ ਜ਼ਿੰਮੇਵਾਰ ਨਹੀਂ। ਨਾ-ਹਟਾਏ ਜਾ ਸਕਣ ਵਾਲੇ ਕਾਨੂੰਨੀ ਹੱਕ ਬਰਕਰਾਰ ਹਨ।"],
    ],
  },
  ta: {
    label: "பொறுப்புத் துறப்பு", eyebrow: "பொறுப்புத் துறப்பு", title: "இந்தத் தளம் மற்றும் அதன் சேவைகள் பற்றிய முக்கிய தகவல்.",
    intro: "அமல்: 24 ஆகஸ்ட் 2026. உள்ளடக்கத்தை நம்புவதற்கு, மூன்றாம் தரப்பு சேவையைப் பயன்படுத்துவதற்கு அல்லது பணம் செலுத்துவதற்கு முன் படிக்கவும்.",
    sections: [
      ["AI உதவியுள்ள சேவை", "வடிவமைப்பு, உருவாக்கம், இயக்கம், மொழிபெயர்ப்பு, சுருக்கம் மற்றும் உள்ளடக்க உருவாக்கத்தில் உதவ இந்தத் தளம் செயற்கை நுண்ணறிவு கருவிகளைப் பயன்படுத்துகிறது. AI உதவி அல்லது மனித மதிப்பாய்வு பெற்ற தகவலும் முழுமையற்றதாக, பழையதாக அல்லது தவறாக இருக்கலாம்."],
      ["துல்லியம் மற்றும் விலைப் பிழைகள்", "விலைகள், கட்டணங்கள், சலுகைகள், தயாரிப்பு விவரங்கள், மாற்று விகிதங்கள் அல்லது சந்தைத் தரவு உட்பட எந்த உள்ளடக்கத்தின் துல்லியம், முழுமை, கிடைப்புத்தன்மை அல்லது காலச்சரிவையும் நாங்கள் உறுதி செய்யவில்லை. செயல்பட அல்லது செலுத்த முன் சரிபார்க்கவும். வெளியிடப்பட்ட பிழை கட்டுப்படுத்தும் கடமையை உருவாக்காது; அது திருத்தப்படலாம்."],
      ["மூன்றாம் தரப்பு தளங்கள்", "X, Facebook, TikTok, வாலெட் செயலிகள், கிரிப்டோ பரிமாற்றங்கள், நெறிமுறைகள் மற்றும் குறிப்பிடப்பட்ட அல்லது இணைக்கப்பட்ட சேவைகள் சுயாதீன மூன்றாம் தரப்புகள். குறிப்பு அல்லது இணைப்பு ஆதரவு அல்ல; அவற்றின் விதிமுறைகள், தனியுரிமை, கிடைப்புத்தன்மை மற்றும் அபாயங்கள் பொருந்தும்."],
      ["கிரிப்டோ மற்றும் நிதி அபாயம்", "உள்ளடக்கம் பொதுத் தகவல் மட்டுமே; முதலீடு, நிதி, சட்டம் அல்லது வரி ஆலோசனை அல்ல. டிஜிட்டல் சொத்துகள் ஏற்ற இறக்கமுடையவை; பிளாக்செயின் பரிவர்த்தனைகள் மாற்ற முடியாதவையாக இருக்கலாம். பெறுநர், முகவரி, வலை, டோக்கன், தொகை, கட்டணம் மற்றும் சட்டத் தேவைகளைச் சரிபார்க்கவும். முடிவுகளுக்கும் கணக்கு பாதுகாப்பிற்கும் நீங்கள் பொறுப்பு."],
      ["இறுதி மற்றும் திருப்பமில்லா பணம்", "பொருந்தும் சட்டம் வேறு விதமாகக் கோராத வரை அனைத்து பணமும் இறுதியானதும் திருப்பமில்லாததும் ஆகும். இறுதி விலை, நாணயம் அல்லது டோக்கன், வலை, பெறுநர் மற்றும் விதிமுறைகளை உறுதி செய்யவும். மனமாற்றம், சந்தை மாற்றம், பயனர் பிழை அல்லது மூன்றாம் தரப்பு கட்டணத்திற்கு திருப்பம் இல்லை. வெளிப்படையான விலை அல்லது பட்டியல் பிழையுள்ள முடிக்கப்படாத ஆர்டர் மறுக்கப்படலாம் அல்லது ரத்து செய்யப்படலாம்."],
      ["உத்தரவாதமின்மை மற்றும் பொறுப்பு வரம்பு", "சட்டம் அனுமதிக்கும் அதிகபட்ச அளவில் தளமும் இயக்குநர்களும் கிடைக்கும் நிலையில் உத்தரவாதமின்றி சேவை வழங்குகின்றனர்; தவறான உள்ளடக்கம், தடங்கல், மூன்றாம் தரப்பு, டிஜிட்டல் சொத்து, வலை நிகழ்வு அல்லது அனுமதியற்ற கணக்கு செயலால் ஏற்படும் இழப்புக்கு பொறுப்பல்ல. சட்டப்படி விலக்க முடியாத உரிமைகள் தொடரும்."],
    ],
  },
  te: {
    label: "నిరాకరణ", eyebrow: "నిరాకరణ", title: "ఈ సైట్ మరియు దాని సేవల గురించి ముఖ్యమైన సమాచారం.",
    intro: "అమలు: 24 ఆగస్టు 2026. కంటెంట్‌పై ఆధారపడే ముందు, మూడవ పక్ష సేవను ఉపయోగించే ముందు లేదా చెల్లించే ముందు చదవండి.",
    sections: [
      ["AI సహాయక సేవ", "రూపకల్పన, అభివృద్ధి, నిర్వహణ, అనువాదం, సారాంశం మరియు కంటెంట్ సృష్టికి ఈ సైట్ కృత్రిమ మేధస్సు సాధనాలను ఉపయోగిస్తుంది. AI సహాయం లేదా మానవ సమీక్ష పొందిన విషయం కూడా అసంపూర్ణం, పాతది లేదా తప్పుగా ఉండవచ్చు."],
      ["ఖచ్చితత్వం మరియు ధర పొరపాట్లు", "ధరలు, ఫీజులు, ఆఫర్లు, ఉత్పత్తి వివరాలు, మారకపు రేట్లు లేదా మార్కెట్ డేటాతో సహా ఏ కంటెంట్ ఖచ్చితత్వం, సంపూర్ణత, లభ్యత లేదా సమయానుకూలతకు మేము హామీ ఇవ్వము. చర్య లేదా చెల్లింపుకు ముందు ముఖ్య సమాచారాన్ని ధృవీకరించండి. ప్రచురిత పొరపాటు బంధించే బాధ్యతను సృష్టించదు; దాన్ని సరిచేయవచ్చు."],
      ["మూడవ పక్ష ప్లాట్‌ఫారమ్‌లు", "X, Facebook, TikTok, వాలెట్ యాప్‌లు, క్రిప్టో ఎక్స్చేంజీలు, ప్రోటోకాల్స్ మరియు లింక్ చేసిన లేదా పేర్కొన్న ఇతర సేవలు స్వతంత్ర మూడవ పక్షాలు. సూచన లేదా లింక్ ఆమోదం కాదు; వాటి నియమాలు, గోప్యత, లభ్యత మరియు ప్రమాదాలు వర్తిస్తాయి."],
      ["క్రిప్టో మరియు ఆర్థిక ప్రమాదం", "కంటెంట్ సాధారణ సమాచారం మాత్రమే; పెట్టుబడి, ఆర్థిక, న్యాయ లేదా పన్ను సలహా కాదు. డిజిటల్ ఆస్తులు అస్థిరమైనవి; బ్లాక్‌చైన్ లావాదేవీలు తిరస్కరించలేనివి కావచ్చు. గ్రహీత, చిరునామా, నెట్‌వర్క్, టోకెన్, మొత్తం, ఫీజులు మరియు చట్ట అవసరాలను ధృవీకరించండి. నిర్ణయాలు మరియు ఖాతా భద్రత మీ బాధ్యత."],
      ["తుది మరియు తిరిగి చెల్లించని చెల్లింపులు", "వర్తించే చట్టం వేరుగా కోరితే తప్ప అన్ని చెల్లింపులు తుది మరియు తిరిగి ఇవ్వబడవు. తుది ధర, కరెన్సీ లేదా టోకెన్, నెట్‌వర్క్, గ్రహీత మరియు షరతులను నిర్ధారించండి. అభిప్రాయం మారడం, మార్కెట్ మార్పు, వినియోగదారుడి పొరపాటు లేదా మూడవ పక్ష ఫీజుకు రీఫండ్ లేదు. స్పష్టమైన ధర లేదా జాబితా పొరపాటుతో ఉన్న పూర్తి కాని ఆర్డర్ తిరస్కరించబడవచ్చు లేదా రద్దు కావచ్చు."],
      ["హామీ లేదు మరియు బాధ్యత పరిమితి", "చట్టం అనుమతించిన గరిష్ఠ పరిమితిలో సైట్ మరియు నిర్వాహకులు సేవను అందుబాటులో ఉన్నట్టుగా హామీ లేకుండా ఇస్తారు; తప్పు కంటెంట్, అంతరాయం, మూడవ పక్షాలు, డిజిటల్ ఆస్తులు, నెట్‌వర్క్ ఘటనలు లేదా అనధికార ఖాతా చర్యల నష్టానికి బాధ్యత వహించరు. చట్టపరంగా తొలగించలేని హక్కులు కొనసాగుతాయి."],
    ],
  },
  ne: {
    label: "अस्वीकरण", eyebrow: "अस्वीकरण", title: "यस साइट र यसको सेवाबारे महत्त्वपूर्ण जानकारी।",
    intro: "लागू: २४ अगस्ट २०२६। सामग्रीमा भर पर्नु, तेस्रो पक्षको सेवा प्रयोग गर्नु वा भुक्तानी गर्नु अघि पढ्नुहोस्।",
    sections: [
      ["AI-सहायित सेवा", "यो साइटले डिजाइन, विकास, सञ्चालन, अनुवाद, सारांश र सामग्री सिर्जनामा सहयोग गर्न कृत्रिम बुद्धिमत्ता उपकरण प्रयोग गर्छ। AI-सहायित वा मानिसले समीक्षा गरेको सामग्री पनि अपूर्ण, पुरानो वा गलत हुन सक्छ।"],
      ["शुद्धता र मूल्य त्रुटि", "मूल्य, शुल्क, प्रस्ताव, उत्पादन विवरण, विनिमय दर वा बजार तथ्याङ्कसहित कुनै सामग्रीको शुद्धता, पूर्णता, उपलब्धता वा समयसापेक्षताको ग्यारेन्टी गर्दैनौं। काम वा भुक्तानीअघि महत्त्वपूर्ण जानकारी जाँच्नुहोस्। प्रकाशित त्रुटिले बाध्यकारी दायित्व बनाउँदैन र सच्याउन सकिन्छ।"],
      ["तेस्रो पक्षका प्लेटफर्म", "X, Facebook, TikTok, वालेट एप, क्रिप्टो एक्सचेन्ज, प्रोटोकल र उल्लेखित वा लिंक गरिएका अन्य सेवा स्वतन्त्र तेस्रो पक्ष हुन्। सन्दर्भ वा लिंक समर्थन होइन; तिनका सर्त, गोपनीयता, उपलब्धता र जोखिम लागू हुन्छन्।"],
      ["क्रिप्टो र वित्तीय जोखिम", "सामग्री सामान्य जानकारी हो, लगानी, वित्तीय, कानुनी वा कर सल्लाह होइन। डिजिटल सम्पत्ति अस्थिर हुन्छ र ब्लकचेन कारोबार उल्टाउन नसकिने हुन सक्छ। प्राप्तकर्ता, ठेगाना, नेटवर्क, टोकन, रकम, शुल्क र कानुनी आवश्यकता जाँच्नुहोस्। निर्णय र खाता सुरक्षा तपाईंको जिम्मेवारी हो।"],
      ["अन्तिम र फिर्ता नहुने भुक्तानी", "लागू कानुनले अन्यथा मागेको बाहेक सबै भुक्तानी अन्तिम र फिर्ता नहुने छन्। अन्तिम मूल्य, मुद्रा वा टोकन, नेटवर्क, प्राप्तकर्ता र सर्त पुष्टि गर्नुहोस्। मन परिवर्तन, बजार चाल, प्रयोगकर्ता त्रुटि वा तेस्रो पक्ष शुल्कमा फिर्ता हुँदैन। स्पष्ट मूल्य वा सूची त्रुटि भएको अधुरो अर्डर अस्वीकार वा रद्द हुन सक्छ।"],
      ["वारेन्टी छैन र दायित्व सीमा", "कानुनले अनुमति दिएको अधिकतम सीमासम्म साइट र सञ्चालकले सेवा उपलब्धताअनुसार वारेन्टीबिना दिन्छन् र गलत सामग्री, अवरोध, तेस्रो पक्ष, डिजिटल सम्पत्ति, नेटवर्क घटना वा अनधिकृत खाता गतिविधिबाट हुने नोक्सानीका लागि जिम्मेवार हुँदैनन्। कानुनले हटाउन नसक्ने अधिकार कायम रहन्छ।"],
    ],
  },
  si: {
    label: "වගකීම් ප්‍රතික්ෂේපය", eyebrow: "වගකීම් ප්‍රතික්ෂේපය", title: "මෙම අඩවිය සහ එහි සේවා පිළිබඳ වැදගත් තොරතුරු.",
    intro: "බලපැවැත්වෙන්නේ 2026 අගෝස්තු 24 සිටය. අන්තර්ගතය මත රඳා සිටීමට, තෙවන පාර්ශ්ව සේවාවක් භාවිත කිරීමට හෝ ගෙවීමට පෙර කියවන්න.",
    sections: [
      ["AI සහාය ඇති සේවාව", "මෙම අඩවිය සැලසුම්, සංවර්ධන, මෙහෙයුම්, පරිවර්තන, සාරාංශ සහ අන්තර්ගත නිර්මාණයට කෘත්‍රිම බුද්ධි මෙවලම් භාවිත කරයි. AI සහාය ලැබූ හෝ මිනිස් සමාලෝචනය කළ දේද අසම්පූර්ණ, පැරණි හෝ වැරදි විය හැක."],
      ["නිරවද්‍යතාව සහ මිල දෝෂ", "මිල, ගාස්තු, දීමනා, නිෂ්පාදන විස්තර, විනිමය අනුපාත හෝ වෙළඳපොළ දත්ත ඇතුළු අන්තර්ගතයක නිරවද්‍යතාව, සම්පූර්ණතාව, ලබාගත හැකි බව හෝ කාලීන බව අපි සහතික නොකරමු. ක්‍රියා කිරීමට හෝ ගෙවීමට පෙර තොරතුරු තහවුරු කරන්න. ප්‍රකාශිත දෝෂයක් බැඳීමක් නොවනු ඇති අතර නිවැරදි කළ හැක."],
      ["තෙවන පාර්ශ්ව වේදිකා", "X, Facebook, TikTok, වොලට් යෙදුම්, ක්‍රිප්ටෝ හුවමාරු, ප්‍රොටොකෝල සහ සම්බන්ධ හෝ සඳහන් සේවා ස්වාධීන තෙවන පාර්ශ්ව වේ. සඳහනක් හෝ සබැඳියක් අනුමැතියක් නොවේ; ඔවුන්ගේ කොන්දේසි, පෞද්ගලිකත්වය, ලබාගත හැකි බව සහ අවදානම් අදාළ වේ."],
      ["ක්‍රිප්ටෝ සහ මූල්‍ය අවදානම", "අන්තර්ගතය සාමාන්‍ය තොරතුරු පමණක් වන අතර ආයෝජන, මූල්‍ය, නීති හෝ බදු උපදෙස් නොවේ. ඩිජිටල් වත්කම් අස්ථාවර වන අතර බ්ලොක්චේන් ගනුදෙනු ආපසු හැරවිය නොහැක. ලබන්නා, ලිපිනය, ජාලය, ටෝකනය, මුදල, ගාස්තු සහ නීති අවශ්‍යතා තහවුරු කරන්න. තීරණ සහ ගිණුම් ආරක්ෂාව ඔබේ වගකීමයි."],
      ["අවසන් සහ ආපසු නොගෙවන ගෙවීම්", "අදාළ නීතිය වෙනත් ලෙස නියම නොකළහොත් සියලු ගෙවීම් අවසන් වන අතර ආපසු ගෙවනු නොලැබේ. අවසන් මිල, මුදල් හෝ ටෝකනය, ජාලය, ලබන්නා සහ කොන්දේසි තහවුරු කරන්න. අදහස වෙනස් වීම, වෙළඳපොළ චලනය, පරිශීලක දෝෂ හෝ තෙවන පාර්ශ්ව ගාස්තු සඳහා ආපසු ගෙවීමක් නැත. පැහැදිලි මිල හෝ ලැයිස්තු දෝෂයකින් බලපෑ අසම්පූර්ණ ඇණවුම ප්‍රතික්ෂේප හෝ අවලංගු කළ හැක."],
      ["වගකීමක් නොමැතිවීම සහ සීමාව", "නීතියෙන් අවසර දෙන උපරිම සීමාවට අඩවිය සහ මෙහෙයුම්කරුවන් සේවාව ලබාගත හැකි අයුරින් වගකීමකින් තොරව සපයන අතර වැරදි අන්තර්ගතය, බාධා, තෙවන පාර්ශ්ව, ඩිජිටල් වත්කම්, ජාල සිදුවීම් හෝ අනවසර ගිණුම් ක්‍රියාකාරකම් නිසා වූ පාඩුවට වගකිව නොහැක. නීතියෙන් ඉවත් කළ නොහැකි අයිතිවාසිකම් පවතී."],
    ],
  },
  tr: {
    label: "Sorumluluk reddi", eyebrow: "SORUMLULUK REDDİ", title: "Bu site ve hizmetleri hakkında önemli bilgiler.",
    intro: "24 Ağustos 2026 tarihinde yürürlüğe girer. İçeriğe güvenmeden, üçüncü taraf hizmeti kullanmadan veya ödeme yapmadan önce okuyun.",
    sections: [
      ["Yapay zekâ destekli hizmet", "Bu site tasarım, geliştirme, işletim, çeviri, özetleme ve içerik üretimine yardımcı olmak için yapay zekâ araçları kullanır. Yapay zekâ destekli veya insan tarafından incelenmiş materyal yine de eksik, eski veya yanlış olabilir."],
      ["Doğruluk ve fiyat hataları", "Fiyatlar, ücretler, teklifler, ürün ayrıntıları, döviz kurları veya piyasa verileri dahil hiçbir içeriğin doğruluğunu, eksiksizliğini, kullanılabilirliğini veya güncelliğini garanti etmeyiz. İşlem veya ödeme öncesinde önemli bilgileri doğrulayın. Yayımlanan hata bağlayıcı yükümlülük oluşturmaz ve düzeltilebilir."],
      ["Üçüncü taraf platformları", "X, Facebook, TikTok, cüzdan uygulamaları, kripto borsaları, protokoller ve bağlantı verilen ya da anılan diğer hizmetler bağımsız üçüncü taraflardır. Atıf veya bağlantı onay anlamına gelmez; kendi şartları, gizlilik kuralları, kullanılabilirlikleri ve riskleri geçerlidir."],
      ["Kripto ve finansal risk", "İçerik genel bilgidir; yatırım, finans, hukuk veya vergi tavsiyesi değildir. Dijital varlıklar oynaktır ve blokzincir işlemleri geri alınamayabilir. Alıcıyı, adresi, ağı, tokeni, tutarı, ücretleri ve yasal gerekleri doğrulayın. Kararlarınızdan ve hesap güvenliğinden siz sorumlusunuz."],
      ["Kesin ve iade edilemez ödemeler", "Yürürlükteki yasa aksini gerektirmedikçe tüm ödemeler kesindir ve iade edilmez. Ödeme öncesinde son fiyatı, para birimini veya tokeni, ağı, alıcıyı ve koşulları doğrulayın. Fikir değişikliği, piyasa hareketi, kullanıcı hatası veya üçüncü taraf ücretleri için iade yapılmaz. Açık fiyat veya listeleme hatası içeren tamamlanmamış sipariş reddedilebilir veya iptal edilebilir."],
      ["Garanti yok ve sorumluluk sınırı", "Yasaların izin verdiği en geniş ölçüde site ve işletmecileri hizmeti mevcut haliyle garanti vermeden sunar ve hatalı içeriğe güvenme, kesinti, üçüncü taraf, dijital varlık, ağ olayı veya yetkisiz hesap faaliyeti kaynaklı kayıplardan sorumlu olmaz. Yasal olarak hariç tutulamayan haklar saklıdır."],
    ],
  },
};

export function disclaimerFor(locale: string | null | undefined): DisclaimerCopy {
  return copies[(DISCLAIMER_LOCALES as readonly string[]).includes(locale ?? "") ? locale as DisclaimerLocale : "en"];
}
