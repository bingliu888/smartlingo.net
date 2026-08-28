import AppKit
import Foundation
import WebKit

struct LayoutViewport: Decodable {
  let id: String
  let width: Int
  let height: Int
}

struct LayoutRoute: Decodable {
  let route: String
  let loadPath: String
  let readySelector: String?
}

struct LayoutConfig: Decodable {
  let baseURL: String
  let routes: [LayoutRoute]
  let languages: [String]
  let viewports: [LayoutViewport]
  let collectorSource: String
  let settleMilliseconds: Int
  let sessionCookieValue: String?
}

final class LayoutRunner: NSObject, WKNavigationDelegate {
  private let config: LayoutConfig
  private let baseScheme: String
  private let baseHost: String
  private let basePort: Int?
  private let webView: WKWebView
  private var routeIndex = 0
  private var languageIndex = 0
  private var viewportIndex = 0
  private var processingNavigation = false
  private var timeoutTimer: Timer?

  init(config: LayoutConfig) {
    self.config = config
    let configuredBaseURL = URL(string: config.baseURL)
    self.baseScheme = configuredBaseURL?.scheme ?? ""
    self.baseHost = configuredBaseURL?.host ?? ""
    self.basePort = configuredBaseURL?.port ?? (configuredBaseURL?.scheme == "https" ? 443 : 80)
    let webConfiguration = WKWebViewConfiguration()
    webConfiguration.websiteDataStore = .nonPersistent()
    webConfiguration.defaultWebpagePreferences.allowsContentJavaScript = true
    let first = config.viewports.first ?? LayoutViewport(id: "default", width: 390, height: 844)
    self.webView = WKWebView(
      frame: NSRect(x: 0, y: 0, width: first.width, height: first.height),
      configuration: webConfiguration
    )
    super.init()
    webView.navigationDelegate = self
  }

  func webView(
    _ webView: WKWebView,
    decidePolicyFor navigationAction: WKNavigationAction,
    decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
  ) {
    if navigationAction.targetFrame?.isMainFrame == true,
       let url = navigationAction.request.url {
      let port = url.port ?? (url.scheme == "https" ? 443 : 80)
      if baseHost.isEmpty || url.scheme != baseScheme || url.host != baseHost || port != basePort {
        decisionHandler(.cancel)
        return
      }
    }
    decisionHandler(.allow)
  }

  func start() {
    guard !config.routes.isEmpty, !config.languages.isEmpty, !config.viewports.isEmpty else {
      fail("runtime-layout config must include routes, languages, and viewports")
      return
    }
    let combinationCount = config.routes.count * config.languages.count * config.viewports.count
    // A key-page subset comfortably fits the four-minute floor, while the
    // release matrix needs a bounded allowance that grows with every real
    // route/language/viewport navigation. Cap it so a stalled WebKit process
    // still fails deterministically.
    let timeoutSeconds = min(900.0, max(240.0, Double(combinationCount) * 5.0))
    timeoutTimer = Timer.scheduledTimer(withTimeInterval: timeoutSeconds, repeats: false) { [weak self] _ in
      self?.fail("runtime-layout WebKit matrix timed out")
    }
    if let sessionCookieValue = config.sessionCookieValue,
       let baseURL = URL(string: config.baseURL),
       let cookie = HTTPCookie(properties: [
         .name: "smartlingo_session",
         .value: sessionCookieValue,
         .originURL: baseURL,
         .path: "/",
         HTTPCookiePropertyKey("HttpOnly"): "TRUE",
       ]) {
      let cookieStore = webView.configuration.websiteDataStore.httpCookieStore
      storeSessionCookie(cookie, value: sessionCookieValue, cookieStore: cookieStore, remainingAttempts: 5)
    } else {
      loadCurrentPage()
    }
  }

  private func storeSessionCookie(
    _ cookie: HTTPCookie,
    value: String,
    cookieStore: WKHTTPCookieStore,
    remainingAttempts: Int
  ) {
    cookieStore.setCookie(cookie) { [weak self] in
      cookieStore.getAllCookies { cookies in
        if cookies.contains(where: {
          $0.name == "smartlingo_session" && $0.value == value && !$0.isSecure
        }) {
          DispatchQueue.main.async { self?.loadCurrentPage() }
          return
        }
        guard remainingAttempts > 0 else {
          self?.fail("loopback layout session cookie was not stored as a non-secure cookie")
          return
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + .milliseconds(150)) {
          self?.storeSessionCookie(cookie, value: value, cookieStore: cookieStore, remainingAttempts: remainingAttempts - 1)
        }
      }
    }
  }

  private func localizedPath(route: LayoutRoute, language: String) -> String {
    let suffix = route.loadPath == "/" ? "" : route.loadPath
    return "/\(language)\(suffix)"
  }

  private func loadCurrentPage() {
    processingNavigation = false
    viewportIndex = 0
    let route = config.routes[routeIndex]
    let language = config.languages[languageIndex]
    let path = localizedPath(route: route, language: language)
    guard let base = URL(string: config.baseURL), let url = URL(string: path, relativeTo: base)?.absoluteURL else {
      fail("invalid base URL or route: \(config.baseURL) \(path)")
      return
    }
    webView.frame = NSRect(
      x: 0,
      y: 0,
      width: config.viewports[0].width,
      height: config.viewports[0].height
    )
    webView.load(URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 30))
  }

  func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
    guard !processingNavigation else { return }
    processingNavigation = true
    waitForReady(remainingAttempts: 60)
  }

  func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
    fail("navigation failed: \(error.localizedDescription)")
  }

  func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
    let failure = error as NSError
    if failure.code == NSURLErrorCancelled || (failure.domain == "WebKitErrorDomain" && failure.code == 102) {
      if !processingNavigation {
        processingNavigation = true
        waitForReady(remainingAttempts: 60)
      }
      return
    }
    fail("provisional navigation failed: \(error.localizedDescription)")
  }

  private func waitForReady(remainingAttempts: Int) {
    let route = config.routes[routeIndex]
    let selector = route.readySelector ?? "[data-layout-page]"
    let readiness = """
      (() => document.readyState === 'complete' && Boolean(document.querySelector(\(jsonString(selector)))))()
      """
    webView.evaluateJavaScript(readiness) { [weak self] result, _ in
      guard let self else { return }
      if result as? Bool == true {
        DispatchQueue.main.asyncAfter(deadline: .now() + .milliseconds(self.config.settleMilliseconds)) {
          self.measureCurrentViewport()
        }
      } else if remainingAttempts > 0 {
        DispatchQueue.main.asyncAfter(deadline: .now() + .milliseconds(200)) {
          self.waitForReady(remainingAttempts: remainingAttempts - 1)
        }
      } else {
        let diagnostic = "JSON.stringify({url:location.href,title:document.title,ready:document.readyState,page:document.querySelector('[data-layout-page]')?.getAttribute('data-layout-page')||'',html:document.documentElement?.outerHTML.slice(0,240)||''})"
        self.webView.evaluateJavaScript(diagnostic) { value, _ in
          let route = self.config.routes[self.routeIndex]
          let language = self.config.languages[self.languageIndex]
          self.fail("page never reached runtime selector \(selector): \(self.localizedPath(route: route, language: language)) · \(value as? String ?? "no diagnostic")")
        }
      }
    }
  }

  private func jsonString(_ value: String) -> String {
    let data = try! JSONSerialization.data(withJSONObject: [value])
    let array = String(data: data, encoding: .utf8)!
    return String(array.dropFirst().dropLast())
  }

  private func measureCurrentViewport() {
    let viewport = config.viewports[viewportIndex]
    webView.frame = NSRect(x: 0, y: 0, width: viewport.width, height: viewport.height)
    DispatchQueue.main.asyncAfter(deadline: .now() + .milliseconds(220)) { [weak self] in
      guard let self else { return }
      let route = self.config.routes[self.routeIndex]
      let language = self.config.languages[self.languageIndex]
      let script = "JSON.stringify((\(self.config.collectorSource))({route:\(self.jsonString(route.route)),tolerance:1.25}))"
      self.webView.evaluateJavaScript(script) { [weak self] result, error in
        guard let self else { return }
        if let error {
          self.fail("layout collector failed: \(error.localizedDescription)")
          return
        }
        guard let reportText = result as? String,
              let reportData = reportText.data(using: .utf8),
              let report = try? JSONSerialization.jsonObject(with: reportData) else {
          self.fail("layout collector returned invalid JSON")
          return
        }
        let envelope: [String: Any] = [
          "route": route.route,
          "loadPath": self.localizedPath(route: route, language: language),
          "language": language,
          "viewport": ["id": viewport.id, "width": viewport.width, "height": viewport.height],
          "report": report,
        ]
        guard let output = try? JSONSerialization.data(withJSONObject: envelope),
              let line = String(data: output, encoding: .utf8) else {
          self.fail("could not encode layout report")
          return
        }
        print(line)
        fflush(stdout)
        self.advance()
      }
    }
  }

  private func advance() {
    viewportIndex += 1
    if viewportIndex < config.viewports.count {
      measureCurrentViewport()
      return
    }
    viewportIndex = 0
    languageIndex += 1
    if languageIndex < config.languages.count {
      loadCurrentPage()
      return
    }
    languageIndex = 0
    routeIndex += 1
    if routeIndex < config.routes.count {
      loadCurrentPage()
      return
    }
    timeoutTimer?.invalidate()
    exit(0)
  }

  private func fail(_ message: String) {
    timeoutTimer?.invalidate()
    fputs("runtime-layout WebKit error: \(message)\n", stderr)
    exit(2)
  }
}

guard CommandLine.arguments.count == 2 else {
  fputs("usage: measure-runtime-layout <config.json>\n", stderr)
  exit(64)
}

do {
  let data = try Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1]))
  let config = try JSONDecoder().decode(LayoutConfig.self, from: data)
  let app = NSApplication.shared
  let runner = LayoutRunner(config: config)
  withExtendedLifetime(runner) {
    runner.start()
    app.run()
  }
} catch {
  fputs("runtime-layout WebKit config error: \(error.localizedDescription)\n", stderr)
  exit(65)
}
