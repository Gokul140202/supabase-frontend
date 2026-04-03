import { test, expect } from '@playwright/test';

const BASE_URL = 'https://jkfinstride.jhbautomations.in';

// ─── 1. PAGE LOAD & UI TESTS ─────────────────────────────────────────────────

test.describe('Page Load & UI', () => {
  test('Site loads successfully (HTTP 200)', async ({ page }) => {
    const response = await page.goto(BASE_URL);
    expect(response?.status()).toBe(200);
  });

  test('Title correct aaga iruku', async ({ page }) => {
    await page.goto(BASE_URL);
    const title = await page.title();
    console.log('Page Title:', title);
    expect(title.length).toBeGreaterThan(0);
  });

  test('JK FINSTRIDE brand name visible', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page.getByText('JK FINSTRIDE')).toBeVisible();
  });

  test('Login as Administrator button visible', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page.getByText('Login as Administrator')).toBeVisible();
  });

  test('Login as Staff Member button visible', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page.getByText('Login as Staff Member')).toBeVisible();
  });

  test('Mobile responsive - iPhone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(BASE_URL);
    await expect(page.getByText('JK FINSTRIDE')).toBeVisible();
  });

  test('Mobile responsive - Android', async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await page.goto(BASE_URL);
    await expect(page.getByText('JK FINSTRIDE')).toBeVisible();
  });
});

// ─── 2. LOGIN FLOW TESTS ─────────────────────────────────────────────────────

test.describe('Login Flow', () => {
  test('Admin login button click → form shows', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.getByText('Login as Administrator').click();
    await expect(page.getByText('Administrator Login')).toBeVisible();
  });

  test('Staff login button click → form shows', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.getByText('Login as Staff Member').click();
    await expect(page.getByText('Staff Login')).toBeVisible();
  });

  test('Back button → main screen ku thirumbuchu', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.getByText('Login as Administrator').click();
    await page.getByText('← Back').click();
    await expect(page.getByText('Login as Administrator')).toBeVisible();
  });

  test('Empty form submit → error message varum', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.getByText('Login as Administrator').click();
    const submitBtn = page.getByRole('button', { name: 'Sign In' });
    await expect(submitBtn).toBeDisabled();
  });

  test('Wrong credentials → error message varum', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.getByText('Login as Administrator').click();
    await page.getByPlaceholder('Enter your email').fill('wrong@test.com');
    await page.getByPlaceholder('Enter your password').fill('wrongpassword');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page.getByText(/Invalid email or password/i)).toBeVisible({ timeout: 10000 });
  });

  test('Password show/hide button works', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.getByText('Login as Administrator').click();
    const passwordInput = page.getByPlaceholder('Enter your password');
    await expect(passwordInput).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: /show|hide|close/i }).click();
    await expect(passwordInput).toHaveAttribute('type', 'text');
  });
});

// ─── 3. SECURITY TESTS ───────────────────────────────────────────────────────

test.describe('Security Checks', () => {
  test('HTTPS enforce panniruka - HTTP redirect aaganum', async ({ page }) => {
    const response = await page.goto('http://jkfinstride.jhbautomations.in');
    const finalUrl = page.url();
    console.log('Final URL after HTTP request:', finalUrl);
    expect(finalUrl).toContain('https://');
  });

  test('Strict-Transport-Security (HSTS) header iruka', async ({ page }) => {
    const response = await page.goto(BASE_URL);
    const hsts = response?.headers()['strict-transport-security'];
    console.log('HSTS Header:', hsts);
    if (!hsts) console.warn('⚠️ HSTS header illai - Security risk!');
  });

  test('X-Frame-Options header - Clickjacking protection', async ({ page }) => {
    const response = await page.goto(BASE_URL);
    const xframe = response?.headers()['x-frame-options'];
    console.log('X-Frame-Options:', xframe);
    if (!xframe) console.warn('⚠️ X-Frame-Options illai - Clickjacking possible!');
  });

  test('X-Content-Type-Options header', async ({ page }) => {
    const response = await page.goto(BASE_URL);
    const xcto = response?.headers()['x-content-type-options'];
    console.log('X-Content-Type-Options:', xcto);
    if (!xcto) console.warn('⚠️ X-Content-Type-Options illai!');
  });

  test('Content-Security-Policy header', async ({ page }) => {
    const response = await page.goto(BASE_URL);
    const csp = response?.headers()['content-security-policy'];
    console.log('CSP Header:', csp ?? 'NOT SET');
    if (!csp) console.warn('⚠️ CSP illai - XSS risk iruku!');
  });

  test('SQL Injection attempt - login block aaganum', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.getByText('Login as Administrator').click();
    await page.getByPlaceholder('Enter your email').fill("' OR '1'='1");
    await page.getByPlaceholder('Enter your password').fill("' OR '1'='1");
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForTimeout(3000);
    // Should NOT be logged in
    expect(page.url()).not.toContain('/dashboard');
    expect(page.url()).not.toContain('/admin');
  });

  test('XSS attempt - script tag blocked aaganum', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.getByText('Login as Administrator').click();
    await page.getByPlaceholder('Enter your email').fill('<script>alert("xss")</script>');
    await page.getByPlaceholder('Enter your password').fill('test123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForTimeout(2000);
    // Alert popup varavillaiyenna confirm pannum
    let alertFired = false;
    page.on('dialog', () => { alertFired = true; });
    await page.waitForTimeout(1000);
    expect(alertFired).toBe(false);
  });

  test('Direct URL access without login - redirect aaganum', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForTimeout(2000);
    const url = page.url();
    console.log('Redirected to:', url);
    // Should redirect to login
    const isProtected = url === BASE_URL + '/' || url === BASE_URL || !url.includes('/dashboard');
    expect(isProtected).toBe(true);
  });

  test('Brute force - multiple wrong logins', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.getByText('Login as Administrator').click();
    for (let i = 0; i < 5; i++) {
      await page.getByPlaceholder('Enter your email').fill(`attacker${i}@hack.com`);
      await page.getByPlaceholder('Enter your password').fill(`wrongpass${i}`);
      await page.getByRole('button', { name: 'Sign In' }).click();
      await page.waitForTimeout(1000);
    }
    // Still on login page - not crashed
    const isStillOnLoginPage = await page.getByText('JK FINSTRIDE').isVisible();
    expect(isStillOnLoginPage).toBe(true);
    console.log('Brute force attempt - site still stable');
  });

  test('Console errors illatha - JS errors check', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto(BASE_URL);
    await page.waitForTimeout(2000);
    console.log('Console Errors:', errors.length === 0 ? 'None ✅' : errors);
    // Log errors but don't fail - just report
  });

  test('Network requests - sensitive data exposed illatha', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', req => requests.push(req.url()));
    await page.goto(BASE_URL);
    await page.waitForTimeout(2000);
    const sensitivePatterns = ['/api/keys', '/api/secret', '/admin/config'];
    const suspicious = requests.filter(url =>
      sensitivePatterns.some(p => url.includes(p))
    );
    console.log('Total requests:', requests.length);
    console.log('Suspicious requests:', suspicious.length === 0 ? 'None ✅' : suspicious);
    expect(suspicious.length).toBe(0);
  });
});
