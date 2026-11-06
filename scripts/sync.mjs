// Public directory sync only. This script has no access to the website source.
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const origin = 'https://jichangnodes.blog';
const root = fileURLToPath(new URL('../', import.meta.url));
const categories = { knowledge: '机场知识', guides: '使用教程', troubleshooting: '常见问题' };
const audiences = { beginner: '新手入门', advanced: '进阶使用' };

function text(value, max = 600) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)) throw new Error('Invalid public text field.');
  return value.trim();
}
const md = value => text(value).replace(/[\r\n]+/g, ' ').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/([\\`*_{}\[\]()#!|])/g, '\\$1');
function url(value, prefix) {
  const parsed = new URL(text(value));
  if (parsed.origin !== origin || parsed.username || parsed.password || parsed.search || parsed.hash || !/^\/[a-z0-9/-]*$/.test(parsed.pathname) || !parsed.pathname.startsWith(prefix) || !parsed.pathname.endsWith('/')) throw new Error('Directory URL must be a canonical website link.');
  return parsed.href;
}
function rows(value, allowEmpty = false) {
  if (!Array.isArray(value) || (!allowEmpty && !value.length) || value.length > 1000) throw new Error('Invalid public directory size.');
  return value;
}
function number(value) {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1_000_000) throw new Error('Invalid public numeric field.');
  return value;
}
function day(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) throw new Error('Invalid article date.');
  return value;
}

// Construct fresh objects from known fields. Unknown response fields are never copied.
export function validate(data) {
  if (data.schemaVersion !== 1 || data.site?.url?.replace(/\/$/, '') !== origin) throw new Error('Unexpected public directory schema or website.');
  const site = { name: text(data.site.name), description: text(data.site.description) };
  const airports = rows(data.airports).map(a => ({ name: text(a.name), url: url(a.url, '/airports/'), summary: text(a.summary), monthlyPrice: number(a.monthlyPrice), monthlyTraffic: number(a.monthlyTraffic), tags: rows(a.tags, true).slice(0, 3).map(t => text(t, 50)) }));
  const clients = rows(data.clients).map(c => ({ name: text(c.name), url: url(c.url, '/clients/'), description: text(c.description), platforms: rows(c.platforms).map(p => text(p, 50)) }));
  const articles = rows(data.articles).map(a => {
    if (!categories[a.category] || (a.audience != null && !audiences[a.audience])) throw new Error('Invalid article category or audience.');
    return { title: text(a.title), url: url(a.url, `/${a.category}/`), description: text(a.description), category: a.category, audience: a.audience, date: day(a.date), updated: a.updated == null ? null : day(a.updated) };
  });
  const links = [...airports, ...clients, ...articles].map(item => item.url);
  if (new Set(links).size !== links.length) throw new Error('Duplicate public directory URL.');
  return { site, airports, clients, articles };
}

export function render(input) {
  const { site, airports, clients, articles } = validate(input);
  const link = (label, address) => `[${md(label)}](${address})`;
  const airportTable = ['| 顺序 | 机场 | 实际月付起价 | 月度流量 | 要点 |', '| --- | --- | --- | --- | --- |', ...airports.map((a, i) => `| ${i + 1} | ${link(a.name, a.url)} | ${a.monthlyPrice === null ? '查看套餐' : `¥${a.monthlyPrice}`} | ${a.monthlyTraffic === null ? '查看套餐' : `${a.monthlyTraffic} GB`} | ${md(a.summary)} |`)].join('\n');
  const clientTable = ['| 客户端 / 内核 | 适用平台 |', '| --- | --- |', ...clients.map(c => `| ${link(c.name, c.url)} | ${c.platforms.map(md).join(' · ')} |`)].join('\n');
  const preview = articles.slice(0, 10).map(a => `- ${link(a.title, a.url)} · ${categories[a.category]}${a.audience ? ` · ${audiences[a.audience]}` : ''}`).join('\n');
  const readme = `# ${md(site.name)} · 机场推荐与网络使用指南

${md(site.description)}

**[访问网站](${origin}/)** · **[机场推荐](${origin}/airports/)** · **[客户端指南](${origin}/clients/)** · **[新手常见问题](${origin}/troubleshooting/)**

本仓库是机场节点的公开内容导航，汇总已上线的机场推荐、Clash / Mihomo / v2ray 客户端介绍和实用教程。

## 内容导航

| 栏目 | 可以了解什么 |
| --- | --- |
| [机场推荐](${origin}/airports/) | ${airports.length} 家机场的套餐、流量、优惠与适用需求 |
| [便宜机场](${origin}/airports/budget/) | 按实际月付预算比较套餐 |
| [按量付费](${origin}/airports/pay-as-you-go/) | 按量套餐与备用需求 |
| [客户端](${origin}/clients/) | ${clients.length} 款客户端及代理内核的安装入口与使用说明 |
| [机场知识](${origin}/knowledge/) | 订阅、协议、流量、延迟和使用方式 |
| [使用教程](${origin}/guides/) | 手机、电脑与常用客户端的操作步骤 |
| [常见问题](${origin}/troubleshooting/) | 新手入门与进阶排查，含电视连接、订阅导入等 |

## 机场推荐

${airportTable}

以上为实际月付档位，年付折合价与一次性流量包请查看详情。价格、流量及支持条件以服务商结算页为准。

## Clash、Mihomo 与 v2ray 客户端

${clientTable}

客户端与机场订阅需要分别选择，具体支持条件可在对应指南中查看。

## 近期文章

${preview}

已收录 **${articles.length} 篇**文章，查看[完整内容目录](DIRECTORY.md)。

## 自动更新

本仓库自动读取网站已发布的公开目录，每 30 分钟检查一次，内容发生变化时更新。GitHub 调度繁忙时可能延迟。工作流支持手动运行。

这里只保存网站介绍、公开内容导航和目录同步工具。网站开发源码、原始资料、配置凭据与私有仓库历史不在本仓库中。

## 相关主题

机场推荐 · 梯子推荐 · 便宜机场 · Clash 机场 · v2ray 机场 · 性价比机场 · Clash Meta · Mihomo · Shadowrocket · 网络知识

## 联系与说明

- 网站：[jichangnodes.blog](${origin}/)
- 联系站长：[Telegram](https://t.me/xiaoyu33s)
- 部分网站访问链接包含推广关系，详见[推广链接说明](${origin}/disclosure/)。
- 机场与客户端商标、Logo 归各自权利人所有。
`;
  const groups = Object.entries(categories).map(([id, label]) => {
    const entries = articles.filter(a => a.category === id);
    return `## ${label}\n\n` + entries.map(a => `### ${link(a.title, a.url)}\n\n${md(a.description)}\n\n${a.audience ? `适合：${audiences[a.audience]} · ` : ''}发布日期：${a.date}${a.updated ? ` · 更新日期：${a.updated}` : ''}\n`).join('\n');
  }).join('\n');
  const clientDetails = clients.map(c => `### ${link(c.name, c.url)}\n\n${md(c.description)}\n\n适用平台：${c.platforms.map(md).join(' · ')}\n`).join('\n');
  const airportDetails = airports.map(a => `- ${link(a.name, a.url)}${a.tags.length ? ` · ${a.tags.map(md).join(' · ')}` : ''}`).join('\n');
  const directory = `# 机场节点 · 完整内容目录\n\n[网站首页](${origin}/) · [返回仓库介绍](README.md)\n\n收录 ${airports.length} 家机场、${clients.length} 款客户端及内核、${articles.length} 篇知识与教程。\n\n## 机场速览\n\n${airportDetails}\n\n## 客户端与内核\n\n${clientDetails}\n${groups}\n`;
  return { 'README.md': readme, 'DIRECTORY.md': directory };
}

export async function sync() {
  const response = await fetch(`${origin}/showcase.json`, { redirect: 'error', signal: AbortSignal.timeout(30_000), headers: { Accept: 'application/json', 'User-Agent': 'jichangnodes-public-directory/1.0' } });
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error(`Public directory is unavailable (${response.status}). Existing documents are preserved.`);
  const bytes = await response.text();
  if (Buffer.byteLength(bytes) > 2_000_000) throw new Error('Unexpected public directory size.');
  const output = render(JSON.parse(bytes));
  for (const [name, contents] of Object.entries(output)) await writeFile(new URL(`../${name}`, import.meta.url), contents);
  console.log(`Updated ${Object.keys(output).join(', ')} from published website content.`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(root, 'scripts/sync.mjs')) {
  try { await sync(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
