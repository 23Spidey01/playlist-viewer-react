package com.example.hitbloqproxy.apikey;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import org.springframework.web.filter.OncePerRequestFilter;

/** Bound bytes before JSON binding, including requests without a Content-Length header. */
public final class ApiKeyRequestSizeFilter extends OncePerRequestFilter {
    private final int maxBytes;

    public ApiKeyRequestSizeFilter(ApiKeyLimits limits) {
        this.maxBytes = limits.getMaxRequestBytes();
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI().substring(request.getContextPath().length());
        return !(path.equals("/api/api-keys") || path.startsWith("/api/api-keys/"))
                || !("POST".equals(request.getMethod()) || "PUT".equals(request.getMethod())
                || "PATCH".equals(request.getMethod()));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (request.getContentLengthLong() > maxBytes) {
            response.sendError(413, "API key request is too large");
            return;
        }
        byte[] body = request.getInputStream().readNBytes(maxBytes + 1);
        if (body.length > maxBytes) {
            response.sendError(413, "API key request is too large");
            return;
        }
        chain.doFilter(new BufferedRequest(request, body), response);
    }

    private static final class BufferedRequest extends HttpServletRequestWrapper {
        private final byte[] body;
        private final ServletInputStream input;

        private BufferedRequest(HttpServletRequest request, byte[] body) {
            super(request);
            this.body = body;
            var stream = new ByteArrayInputStream(body);
            this.input = new ServletInputStream() {
                @Override public int read() { return stream.read(); }
                @Override public int read(byte[] bytes, int offset, int length) { return stream.read(bytes, offset, length); }
                @Override public boolean isFinished() { return stream.available() == 0; }
                @Override public boolean isReady() { return true; }
                @Override public void setReadListener(ReadListener listener) {
                    throw new UnsupportedOperationException("API key requests use synchronous request bodies");
                }
            };
        }

        @Override public ServletInputStream getInputStream() { return input; }
        @Override public int getContentLength() { return body.length; }
        @Override public long getContentLengthLong() { return body.length; }
        @Override public BufferedReader getReader() throws IOException {
            String encoding = getCharacterEncoding();
            return new BufferedReader(new InputStreamReader(input,
                    encoding == null ? StandardCharsets.UTF_8.name() : encoding));
        }
    }
}
