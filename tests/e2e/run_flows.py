"""VRENN — Playwright end-to-end flow tests.

Run with:  python tests/e2e/run_flows.py

Requires the dev server or preview to be reachable at BASE_URL and (for
authenticated flows) the managed Supabase session env vars from the sandbox.
"""
import asyncio, json, os, sys
from pathlib import Path
from playwright.async_api import async_playwright

BASE_URL = os.environ.get("VRENN_BASE_URL", "http://localhost:8080")
SCREENSHOTS = Path(__file__).parent / "screenshots"
SCREENSHOTS.mkdir(parents=True, exist_ok=True)

results = []

def step(name, ok, note=""):
    tag = "✔" if ok else "✘"
    print(f"  {tag} {name}" + (f" — {note}" if note else ""))
    results.append((name, ok, note))


async def restore_session(page, context):
    storage_key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
    session_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
    cookies_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON")
    if not (storage_key and session_json):
        return False
    if cookies_json:
        cookies = json.loads(cookies_json)
        for c in cookies: c["url"] = BASE_URL
        await context.add_cookies(cookies)
    await page.goto(BASE_URL, wait_until="domcontentloaded")
    await page.evaluate(
        f"window.localStorage.setItem({json.dumps(storage_key)}, {json.dumps(session_json)})"
    )
    return True


async def test_public_home(page):
    print("\n[1] Landing page (público)")
    try:
        await page.goto(BASE_URL, wait_until="domcontentloaded", timeout=15000)
        await page.screenshot(path=str(SCREENSHOTS / "01_landing.png"))
        step("Landing carrega", True, page.url)
    except Exception as e:
        step("Landing carrega", False, str(e))


async def test_auth_page(page):
    print("\n[2] Tela de auth")
    try:
        await page.goto(f"{BASE_URL}/auth", wait_until="domcontentloaded", timeout=15000)
        has_email = await page.locator("input[type=email]").count() > 0
        await page.screenshot(path=str(SCREENSHOTS / "02_auth.png"))
        step("Formulário de login presente", has_email > 0)
    except Exception as e:
        step("Formulário de login presente", False, str(e))


async def test_feed_authenticated(page):
    print("\n[3] Feed autenticado")
    try:
        await page.goto(f"{BASE_URL}/feed", wait_until="networkidle", timeout=20000)
        await page.wait_for_timeout(2000)
        await page.screenshot(path=str(SCREENSHOTS / "03_feed.png"))
        # Se redirecionou para /auth, sessão não estava presente
        url = page.url
        step("Feed acessível (não redirecionou para /auth)", "/auth" not in url, url)
    except Exception as e:
        step("Feed acessível", False, str(e))


async def test_metas_page(page):
    print("\n[4] Página de metas")
    try:
        await page.goto(f"{BASE_URL}/metas", wait_until="networkidle", timeout=20000)
        await page.wait_for_timeout(1500)
        await page.screenshot(path=str(SCREENSHOTS / "04_metas.png"))
        step("Metas carrega", "/auth" not in page.url, page.url)
    except Exception as e:
        step("Metas carrega", False, str(e))


async def test_wallet(page):
    print("\n[5] Wallet")
    try:
        await page.goto(f"{BASE_URL}/wallet", wait_until="networkidle", timeout=20000)
        await page.wait_for_timeout(1500)
        await page.screenshot(path=str(SCREENSHOTS / "05_wallet.png"))
        text = await page.content()
        step("Wallet mostra saldo", "R$" in text or "saldo" in text.lower())
    except Exception as e:
        step("Wallet mostra saldo", False, str(e))


async def test_ranking(page):
    print("\n[6] Ranking")
    try:
        await page.goto(f"{BASE_URL}/ranking", wait_until="networkidle", timeout=20000)
        await page.wait_for_timeout(1500)
        await page.screenshot(path=str(SCREENSHOTS / "06_ranking.png"))
        step("Ranking carrega", "/auth" not in page.url)
    except Exception as e:
        step("Ranking carrega", False, str(e))


async def test_descobrir(page):
    print("\n[7] Descobrir")
    try:
        await page.goto(f"{BASE_URL}/descobrir", wait_until="networkidle", timeout=20000)
        await page.wait_for_timeout(1500)
        await page.screenshot(path=str(SCREENSHOTS / "07_descobrir.png"))
        step("Descobrir carrega", "/auth" not in page.url)
    except Exception as e:
        step("Descobrir carrega", False, str(e))


async def test_console_errors(page):
    print("\n[8] Erros no console")
    errors = []
    page.on("pageerror", lambda err: errors.append(str(err)))
    await page.goto(f"{BASE_URL}/feed", wait_until="networkidle", timeout=20000)
    await page.wait_for_timeout(2500)
    step("Nenhum pageerror no feed", len(errors) == 0, "; ".join(errors[:3]))


async def main():
    print(f"VRENN E2E — target {BASE_URL}")
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()

        await test_public_home(page)
        await test_auth_page(page)

        authed = await restore_session(page, context)
        if authed:
            await test_feed_authenticated(page)
            await test_metas_page(page)
            await test_wallet(page)
            await test_ranking(page)
            await test_descobrir(page)
            await test_console_errors(page)
        else:
            print("\n[!] Sessão do Supabase não disponível — pulei os testes autenticados.")
            print("    Faça login pelo preview para injetar a sessão.")

        await browser.close()

    passed = sum(1 for _, ok, _ in results if ok)
    total = len(results)
    print(f"\n=== Resultado: {passed}/{total} passaram ===")
    if passed < total:
        print("Falhas:")
        for name, ok, note in results:
            if not ok:
                print(f"  ✘ {name} — {note}")
    print(f"Screenshots em: {SCREENSHOTS}")
    sys.exit(0 if passed == total else 1)


if __name__ == "__main__":
    asyncio.run(main())
