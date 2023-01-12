import { WalletConfig } from '../wallets.constants';
import { WalletPage } from '../wallet.page';
import expect from 'expect';
import { test, BrowserContext, Page } from '@playwright/test';

export class XdefiPage implements WalletPage {
  page: Page | undefined;

  constructor(
    private browserContext: BrowserContext,
    private extensionUrl: string,
    public config: WalletConfig,
  ) {}

  async navigate() {
    await test.step('Navigate to xdefi', async () => {
      this.page = await this.browserContext.newPage();
      await this.page.goto(this.extensionUrl + '/app.html');
      await this.page.reload();
      await this.page.waitForTimeout(1000);
      await this.closePopover();
    });
  }

  async setup() {
    await test.step('Setup', async () => {
      // added explicit route to /onboarding due to unexpected first time route from /home.html to /onboarding - page is close
      this.page = await this.browserContext.newPage();
      await this.page.goto(this.extensionUrl + '/onboarding.html');
      if (!this.page) throw "Page isn't ready";
      const firstTime =
        (await this.page.locator("text=Let's get started").count()) > 0;
      if (firstTime) await this.firstTimeSetup();
    });
  }

  async importTokens(token: string) {
    await test.step('Import token', async () => {
      await this.navigate();
      if (!this.page) throw "Page isn't ready";
      await this.page.click('button[data-testid="addAssetsBtn"]');
      await this.page.click('li[data-testid="customTab"]');
      await this.page.type('input[name="address"]', token);
      await this.page.click('button[data-testid="nextBtn"]');
    });
  }

  async closePopover() {
    await test.step('Close popover if exists', async () => {
      if (!this.page) throw "Page isn't ready";
      const popover =
        (await this.page.locator('data-testid=popover-close').count()) > 0;
      if (popover) await this.page.click('data-testid=popover-close');
    });
  }

  async firstTimeSetup() {
    await test.step('First time setup', async () => {
      if (!this.page) throw "Page isn't ready";
      await this.page.click('svg:below(input)');
      await this.page.click('text=Restore XDEFI Wallet');
      await this.page.click('text=Restore with secret phrase');
      await this.page.fill(
        'textarea[name="phrase"]',
        this.config.SECRET_PHRASE,
      );
      await this.page.fill('input[name="password"]', this.config.PASSWORD);
      await this.page.fill(
        'input[name="confirmPassword"]',
        this.config.PASSWORD,
      );
      await this.page.click('button[type="submit"]');
      await this.page.fill(
        'input[name="walletName"]',
        this.config.COMMON.WALLET_NAME,
      );
      await this.page.click('button[type="submit"]');
      await this.page.click('span[data-testid=switchBtn]');
      await this.page.click('button[data-testid=nextBtn]');
      await this.closePopover();
    });
  }

  async importKey(key: string) {
    await test.step('Import key', async () => {
      if (!this.page) throw "Page isn't ready";
      await this.navigate();
      await this.page.click('button[data-testid="menuBtn"]');
      await this.page.click('li[data-testid="walletManagementBtn"]');
      await this.page.click('div[data-testid="importWalletBtn"]');
      await this.page.click('text=Seed Phrase');
      await this.page.fill('textarea[name="[phrase"]', key);
      await this.page.click('svg:below(input)');
      await this.page.click('button[data-testid="importBtn"]');
    });
  }

  async connectWallet(page: Page) {
    await test.step('Connect wallet', async () => {
      await page.click('label[data-testid="selectAllBtn"]');
      await page.click('button[data-testid="nextBtn"]');
      await page.click('button[data-testid="connectBtn"]');
      await page.close();
    });
  }

  async assertTxAmount(page: Page, expectedAmount: string) {
    await test.step('Assert TX Amount', async () => {
      expect(await page.locator(`text=${expectedAmount} ETH`).count()).toBe(1);
    });
  }

  async confirmTx(page: Page) {
    await test.step('Confirm TX', async () => {
      await page.click('button[data-testid="confirmBtn"]');
    });
  }

  // eslint-disable-next-line
  async assertReceiptAddress(page: Page, expectedAddress: string) {}

  // eslint-disable-next-line
  async addNetwork(networkName: string, networkUrl: string, chainId: number, tokenSymbol: string) {}
}