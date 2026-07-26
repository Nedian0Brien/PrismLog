import Foundation

enum PrismAPIError: LocalizedError {
    case badStatus(Int, body: String)
    case offline

    var errorDescription: String? {
        switch self {
        case .badStatus(let code, let body):
            "서버 오류 (HTTP \(code))" + (body.isEmpty ? "" : ": \(body.prefix(160))")
        case .offline:
            "네트워크에 연결할 수 없습니다"
        }
    }
}

/// Talks to the same FastAPI backend the web app uses.
///
/// The API has no authentication — records are scoped by a `user_id` query
/// parameter, exactly as `src/App.jsx` does it.
actor PrismAPIClient {
    static let shared = PrismAPIClient()

    /// The API's own cap is 200 per request (`routers/logs.py`).
    static let pageSize = 200

    private let baseURL: URL
    private let session: URLSession
    private let decoder = JSONDecoder.prism
    private let encoder = JSONEncoder.prism

    init(
        baseURL: URL = URL(string: "https://prism.lawdigest.kr")!,
        session: URLSession = .shared
    ) {
        self.baseURL = baseURL
        self.session = session
    }

    // MARK: - Logs

    /// Pulls every log for the user, following the API's offset pagination.
    func fetchAllLogs(userID: String) async throws -> [LogDTO] {
        var all: [LogDTO] = []
        var offset = 0

        while true {
            let page = try await fetchLogs(userID: userID, limit: Self.pageSize, offset: offset)
            all.append(contentsOf: page)
            if page.count < Self.pageSize { break }
            offset += Self.pageSize
        }

        return all
    }

    func fetchLogs(userID: String, limit: Int, offset: Int) async throws -> [LogDTO] {
        var components = URLComponents(url: url("/api/v1/logs"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "user_id", value: userID),
            URLQueryItem(name: "limit", value: String(limit)),
            URLQueryItem(name: "offset", value: String(offset)),
        ]
        return try await send(URLRequest(url: components.url!))
    }

    func createLog(_ body: LogCreateDTO) async throws -> LogDTO {
        try await send(request("/api/v1/logs", method: "POST", body: body))
    }

    func updateLog(id: UUID, patch: LogUpdateDTO) async throws -> LogDTO {
        try await send(request("/api/v1/logs/\(id.uuidString)", method: "PATCH", body: patch))
    }

    func deleteLog(id: UUID) async throws {
        _ = try await sendRaw(request("/api/v1/logs/\(id.uuidString)", method: "DELETE"))
    }

    // MARK: - Entities

    func createEntity(_ body: LogEntityCreateDTO) async throws -> LogEntityDTO {
        try await send(request("/api/v1/logs/entities", method: "POST", body: body))
    }

    func updateEntity(id: UUID, patch: LogEntityUpdateDTO) async throws -> LogEntityDTO {
        try await send(request("/api/v1/logs/entities/\(id.uuidString)", method: "PATCH", body: patch))
    }

    // MARK: - Plumbing

    private func url(_ path: String) -> URL {
        baseURL.appending(path: path)
    }

    private func request(_ path: String, method: String, body: (some Encodable)? = Optional<Never>.none) throws -> URLRequest {
        var request = URLRequest(url: url(path))
        request.httpMethod = method
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try encoder.encode(body)
        }
        return request
    }

    private func request(_ path: String, method: String) -> URLRequest {
        var request = URLRequest(url: url(path))
        request.httpMethod = method
        return request
    }

    private func send<Response: Decodable>(_ request: URLRequest) async throws -> Response {
        let data = try await sendRaw(request)
        return try decoder.decode(Response.self, from: data)
    }

    @discardableResult
    private func sendRaw(_ request: URLRequest) async throws -> Data {
        let data: Data
        let response: URLResponse

        do {
            (data, response) = try await session.data(for: request)
        } catch let error as URLError where error.isConnectivity {
            throw PrismAPIError.offline
        }

        guard let http = response as? HTTPURLResponse else { return data }
        guard (200..<300).contains(http.statusCode) else {
            throw PrismAPIError.badStatus(
                http.statusCode,
                body: String(data: data, encoding: .utf8) ?? ""
            )
        }

        return data
    }
}

extension URLError {
    var isConnectivity: Bool {
        [.notConnectedToInternet, .networkConnectionLost, .cannotConnectToHost,
         .timedOut, .dataNotAllowed, .internationalRoamingOff].contains(code)
    }
}
