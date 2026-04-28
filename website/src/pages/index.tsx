/** biome-ignore-all lint/a11y/noSvgWithoutTitle: <> */
import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import CodeBlock from "@theme/CodeBlock";
import Layout from "@theme/Layout";
import clsx from "clsx";
import type { ReactNode } from "react";
import styles from "./index.module.css";

export default function Home(): ReactNode {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title={`Durcno - ${siteConfig.tagline}`}
      description="A PostgreSQL Query Builder and Migration Manager for TypeScript, from the future."
    >
      <HomepageHeader />
      <main>
        <SupportedRuntimes />
        <SupportedDatabases />
        <FeatureHighlights />
        <TwitterReviews />
        <Sponsors />
      </main>
    </Layout>
  );
}

const codeExample = `import { asc, eq } from "durcno";
import { db } from "./db/index.ts";
import { Users } from "./db/schema.ts";

// Fully typed result inferred from schema
const admins = await db
  .from(Users)
  .select({
    id: Users.id,
    name: Users.name,
    email: Users.email
  })
  .where(eq(Users.type, "admin"))
  .orderBy(asc(Users.name))
  .limit(10);

// admins: { id: bigint; name: string; email: string }[]
`;

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={clsx("hero", styles.heroBanner)}>
      <div className={styles.heroContainer}>
        <div className={styles.heroContent}>
          <div className={styles.heroBadge}>CRUD, Not an ORM</div>
          <h1 className={styles.heroTitle}>
            Type-Safe SQL for <br />
            Modern Codebases
          </h1>
          <p className={styles.heroSubtitle}>
            {siteConfig.tagline} Experience type safety and robust migration
            management.
          </p>
          <div className={styles.buttons}>
            <Link
              className="button button--primary button--lg"
              to="/docs/latest/intro"
            >
              Get Started
            </Link>
            <Link
              className="button button--secondary button--lg"
              to="https://github.com/durcno/durcno"
            >
              GitHub
            </Link>
          </div>
        </div>
        <div className={styles.heroCode}>
          <div className={styles.codeBlockContainer}>
            <div className={styles.codeHeader}>
              <div className={styles.windowControls}>
                <span
                  className={styles.controlDot}
                  style={{ background: "#FF5F56" }}
                />
                <span
                  className={styles.controlDot}
                  style={{ background: "#FFBD2E" }}
                />
                <span
                  className={styles.controlDot}
                  style={{ background: "#27C93F" }}
                />
              </div>
            </div>
            <CodeBlock language="typescript">{codeExample}</CodeBlock>
          </div>
        </div>
      </div>
    </header>
  );
}

const runtimeList = [
  {
    name: "Node.js",
    icon: (
      <svg
        role="img"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        className={styles.runtimeIcon}
        style={{ color: "#339933" }}
      >
        <title>Node.js</title>
        <path
          d="M11.998,24c-0.321,0-0.641-0.084-0.922-0.247l-2.936-1.737c-0.438-0.245-0.224-0.332-0.08-0.383 c0.585-0.203,0.703-0.25,1.328-0.604c0.065-0.037,0.151-0.023,0.218,0.017l2.256,1.339c0.082,0.045,0.197,0.045,0.272,0l8.795-5.076 c0.082-0.047,0.134-0.141,0.134-0.238V6.921c0-0.099-0.053-0.192-0.137-0.242l-8.791-5.072c-0.081-0.047-0.189-0.047-0.271,0 L3.075,6.68C2.99,6.729,2.936,6.825,2.936,6.921v10.15c0,0.097,0.054,0.189,0.139,0.235l2.409,1.392 c1.307,0.654,2.108-0.116,2.108-0.89V7.787c0-0.142,0.114-0.253,0.256-0.253h1.115c0.139,0,0.255,0.112,0.255,0.253v10.021 c0,1.745-0.95,2.745-2.604,2.745c-0.508,0-0.909,0-2.026-0.551L2.28,18.675c-0.57-0.329-0.922-0.945-0.922-1.604V6.921 c0-0.659,0.353-1.275,0.922-1.603l8.795-5.082c0.557-0.315,1.296-0.315,1.848,0l8.794,5.082c0.57,0.329,0.924,0.944,0.924,1.603 v10.15c0,0.659-0.354,1.273-0.924,1.604l-8.794,5.078C12.643,23.916,12.324,24,11.998,24z M19.099,13.993 c0-1.9-1.284-2.406-3.987-2.763c-2.731-0.361-3.009-0.548-3.009-1.187c0-0.528,0.235-1.233,2.258-1.233 c1.807,0,2.473,0.389,2.747,1.607c0.024,0.115,0.129,0.199,0.247,0.199h1.141c0.071,0,0.138-0.031,0.186-0.081 c0.048-0.054,0.074-0.123,0.067-0.196c-0.177-2.098-1.571-3.076-4.388-3.076c-2.508,0-4.004,1.058-4.004,2.833 c0,1.925,1.488,2.457,3.895,2.695c2.88,0.282,3.103,0.703,3.103,1.269c0,0.983-0.789,1.402-2.642,1.402 c-2.327,0-2.839-0.584-3.011-1.742c-0.02-0.124-0.126-0.215-0.253-0.215h-1.137c-0.141,0-0.254,0.112-0.254,0.253 c0,1.482,0.806,3.248,4.655,3.248C17.501,17.007,19.099,15.91,19.099,13.993z"
          fill="currentColor"
        />
      </svg>
    ),
  },
  {
    name: "Bun",
    icon: (
      <svg
        role="img"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        className={styles.runtimeIcon}
        style={{ color: "#FBF0DF" }}
      >
        <title>Bun</title>
        <path
          d="M12 22.596c6.628 0 12-4.338 12-9.688 0-3.318-2.057-6.248-5.219-7.986-1.286-.715-2.297-1.357-3.139-1.89C14.058 2.025 13.08 1.404 12 1.404c-1.097 0-2.334.785-3.966 1.821a49.92 49.92 0 0 1-2.816 1.697C2.057 6.66 0 9.59 0 12.908c0 5.35 5.372 9.687 12 9.687v.001ZM10.599 4.715c.334-.759.503-1.58.498-2.409 0-.145.202-.187.23-.029.658 2.783-.902 4.162-2.057 4.624-.124.048-.199-.121-.103-.209a5.763 5.763 0 0 0 1.432-1.977Zm2.058-.102a5.82 5.82 0 0 0-.782-2.306v-.016c-.069-.123.086-.263.185-.172 1.962 2.111 1.307 4.067.556 5.051-.082.103-.23-.003-.189-.126a5.85 5.85 0 0 0 .23-2.431Zm1.776-.561a5.727 5.727 0 0 0-1.612-1.806v-.014c-.112-.085-.024-.274.114-.218 2.595 1.087 2.774 3.18 2.459 4.407a.116.116 0 0 1-.049.071.11.11 0 0 1-.153-.026.122.122 0 0 1-.022-.083 5.891 5.891 0 0 0-.737-2.331Zm-5.087.561c-.617.546-1.282.76-2.063 1-.117 0-.195-.078-.156-.181 1.752-.909 2.376-1.649 2.999-2.778 0 0 .155-.118.188.085 0 .304-.349 1.329-.968 1.874Zm4.945 11.237a2.957 2.957 0 0 1-.937 1.553c-.346.346-.8.565-1.286.62a2.178 2.178 0 0 1-1.327-.62 2.955 2.955 0 0 1-.925-1.553.244.244 0 0 1 .064-.198.234.234 0 0 1 .193-.069h3.965a.226.226 0 0 1 .19.07c.05.053.073.125.063.197Zm-5.458-2.176a1.862 1.862 0 0 1-2.384-.245 1.98 1.98 0 0 1-.233-2.447c.207-.319.503-.566.848-.713a1.84 1.84 0 0 1 1.092-.11c.366.075.703.261.967.531a1.98 1.98 0 0 1 .408 2.114 1.931 1.931 0 0 1-.698.869v.001Zm8.495.005a1.86 1.86 0 0 1-2.381-.253 1.964 1.964 0 0 1-.547-1.366c0-.384.11-.76.32-1.079.207-.319.503-.567.849-.713a1.844 1.844 0 0 1 1.093-.108c.367.076.704.262.968.534a1.98 1.98 0 0 1 .4 2.117 1.932 1.932 0 0 1-.702.868Z"
          fill="currentColor"
        />
      </svg>
    ),
  },
  {
    name: "Deno",
    icon: (
      <svg
        role="img"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        className={styles.runtimeIcon}
        style={{ color: "var(--ifm-color-emphasis-900)" }}
      >
        <title>Deno</title>
        <path
          d="M1.105 18.02A11.9 11.9 0 0 1 0 12.985q0-.698.078-1.376a12 12 0 0 1 .231-1.34A12 12 0 0 1 4.025 4.02a12 12 0 0 1 5.46-2.771 12 12 0 0 1 3.428-.23c1.452.112 2.825.477 4.077 1.05a12 12 0 0 1 2.78 1.774 12.02 12.02 0 0 1 4.053 7.078A12 12 0 0 1 24 12.985q0 .454-.036.914a12 12 0 0 1-.728 3.305 12 12 0 0 1-2.38 3.875c-1.33 1.357-3.02 1.962-4.43 1.936a4.4 4.4 0 0 1-2.724-1.024c-.99-.853-1.391-1.83-1.53-2.919a5 5 0 0 1 .128-1.518c.105-.38.37-1.116.76-1.437-.455-.197-1.04-.624-1.226-.829-.045-.05-.04-.13 0-.183a.155.155 0 0 1 .177-.053c.392.134.869.267 1.372.35.66.111 1.484.25 2.317.292 2.03.1 4.153-.813 4.812-2.627s.403-3.609-1.96-4.685-3.454-2.356-5.363-3.128c-1.247-.505-2.636-.205-4.06.582-3.838 2.121-7.277 8.822-5.69 15.032a.191.191 0 0 1-.315.19 12 12 0 0 1-1.25-1.634 12 12 0 0 1-.769-1.404M11.57 6.087c.649-.051 1.214.501 1.31 1.236.13.979-.228 1.99-1.41 2.013-1.01.02-1.315-.997-1.248-1.614.066-.616.574-1.575 1.35-1.635"
          fill="currentColor"
        />
      </svg>
    ),
  },
];

function SupportedRuntimes() {
  return (
    <section className={styles.supportedRuntimesSection}>
      <div className="container">
        <p
          style={{
            textAlign: "center",
            marginBottom: "1.5rem",
            fontWeight: 600,
            opacity: 0.8,
          }}
        >
          Works with your favorite runtime
        </p>
        <div
          className={styles.buttons}
          style={{ justifyContent: "center", gap: "2rem", flexWrap: "wrap" }}
        >
          {runtimeList.map((runtime) => (
            <div
              key={runtime.name}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.5rem",
              }}
              title={runtime.name}
            >
              {runtime.icon}
              <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>
                {runtime.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const dbList = [
  {
    name: "PostgreSQL",
    icon: (
      <svg
        role="img"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        className={styles.dbIcon}
        style={{ color: "#336791" }}
      >
        <title>PostgreSQL</title>
        <path d="M23.5594 14.7228a.5269.5269 0 0 0-.0563-.1191c-.139-.2632-.4768-.3418-1.0074-.2321-1.6533.3411-2.2935.1312-2.5256-.0191 1.342-2.0482 2.445-4.522 3.0411-6.8297.2714-1.0507.7982-3.5237.1222-4.7316a1.5641 1.5641 0 0 0-.1509-.235C21.6931.9086 19.8007.0248 17.5099.0005c-1.4947-.0158-2.7705.3411-3.1161.4794a9.449 9.449 0 0 0-.5159-.0816 8.044 8.044 0 0 0-1.3114-.1278c-1.1822-.0184-2.2038.2642-3.0498.8406-.8573-.3211-4.7888-1.645-7.2219.0788C.9359 2.1526.3086 3.8733.4302 6.3043c.0409.818.5069 3.334 1.2423 5.7436.4598 1.5065.9387 2.7019 1.4334 3.582.553.9942 1.1259 1.5933 1.7143 1.7895.4474.1491 1.1327.1441 1.8581-.7279.8012-.9635 1.5903-1.8258 1.9446-2.2069.4351.2355.9064.3625 1.39.3772a.0569.0569 0 0 0 .0004.0041 11.0312 11.0312 0 0 0-.2472.3054c-.3389.4302-.4094.5197-1.5002.7443-.3102.064-1.1344.2339-1.1464.8115-.0025.1224.0329.2309.0919.3268.2269.4231.9216.6097 1.015.6331 1.3345.3335 2.5044.092 3.3714-.6787-.017 2.231.0775 4.4174.3454 5.0874.2212.5529.7618 1.9045 2.4692 1.9043.2505 0 .5263-.0291.8296-.0941 1.7819-.3821 2.5557-1.1696 2.855-2.9059.1503-.8707.4016-2.8753.5388-4.1012.0169-.0703.0357-.1207.057-.1362.0007-.0005.0697-.0471.4272.0307a.3673.3673 0 0 0 .0443.0068l.2539.0223.0149.001c.8468.0384 1.9114-.1426 2.5312-.4308.6438-.2988 1.8057-1.0323 1.5951-1.6698zM2.371 11.8765c-.7435-2.4358-1.1779-4.8851-1.2123-5.5719-.1086-2.1714.4171-3.6829 1.5623-4.4927 1.8367-1.2986 4.8398-.5408 6.108-.13-.0032.0032-.0066.0061-.0098.0094-2.0238 2.044-1.9758 5.536-1.9708 5.7495-.0002.0823.0066.1989.0162.3593.0348.5873.0996 1.6804-.0735 2.9184-.1609 1.1504.1937 2.2764.9728 3.0892.0806.0841.1648.1631.2518.2374-.3468.3714-1.1004 1.1926-1.9025 2.1576-.5677.6825-.9597.5517-1.0886.5087-.3919-.1307-.813-.5871-1.2381-1.3223-.4796-.839-.9635-2.0317-1.4155-3.5126zm6.0072 5.0871c-.1711-.0428-.3271-.1132-.4322-.1772.0889-.0394.2374-.0902.4833-.1409 1.2833-.2641 1.4815-.4506 1.9143-1.0002.0992-.126.2116-.2687.3673-.4426a.3549.3549 0 0 0 .0737-.1298c.1708-.1513.2724-.1099.4369-.0417.156.0646.3078.26.3695.4752.0291.1016.0619.2945-.0452.4444-.9043 1.2658-2.2216 1.2494-3.1676 1.0128zm2.094-3.988-.0525.141c-.133.3566-.2567.6881-.3334 1.003-.6674-.0021-1.3168-.2872-1.8105-.8024-.6279-.6551-.9131-1.5664-.7825-2.5004.1828-1.3079.1153-2.4468.079-3.0586-.005-.0857-.0095-.1607-.0122-.2199.2957-.2621 1.6659-.9962 2.6429-.7724.4459.1022.7176.4057.8305.928.5846 2.7038.0774 3.8307-.3302 4.7363-.084.1866-.1633.3629-.2311.5454zm7.3637 4.5725c-.0169.1768-.0358.376-.0618.5959l-.146.4383a.3547.3547 0 0 0-.0182.1077c-.0059.4747-.054.6489-.115.8693-.0634.2292-.1353.4891-.1794 1.0575-.11 1.4143-.8782 2.2267-2.4172 2.5565-1.5155.3251-1.7843-.4968-2.0212-1.2217a6.5824 6.5824 0 0 0-.0769-.2266c-.2154-.5858-.1911-1.4119-.1574-2.5551.0165-.5612-.0249-1.9013-.3302-2.6462.0044-.2932.0106-.5909.019-.8918a.3529.3529 0 0 0-.0153-.1126 1.4927 1.4927 0 0 0-.0439-.208c-.1226-.4283-.4213-.7866-.7797-.9351-.1424-.059-.4038-.1672-.7178-.0869.067-.276.1831-.5875.309-.9249l.0529-.142c.0595-.16.134-.3257.213-.5012.4265-.9476 1.0106-2.2453.3766-5.1772-.2374-1.0981-1.0304-1.6343-2.2324-1.5098-.7207.0746-1.3799.3654-1.7088.5321a5.6716 5.6716 0 0 0-.1958.1041c.0918-1.1064.4386-3.1741 1.7357-4.4823a4.0306 4.0306 0 0 1 .3033-.276.3532.3532 0 0 0 .1447-.0644c.7524-.5706 1.6945-.8506 2.802-.8325.4091.0067.8017.0339 1.1742.081 1.939.3544 3.2439 1.4468 4.0359 2.3827.8143.9623 1.2552 1.9315 1.4312 2.4543-1.3232-.1346-2.2234.1268-2.6797.779-.9926 1.4189.543 4.1729 1.2811 5.4964.1353.2426.2522.4522.2889.5413.2403.5825.5515.9713.7787 1.2552.0696.087.1372.1714.1885.245-.4008.1155-1.1208.3825-1.0552 1.717-.0123.1563-.0423.4469-.0834.8148-.0461.2077-.0702.4603-.0994.7662zm.8905-1.6211c-.0405-.8316.2691-.9185.5967-1.0105a2.8566 2.8566 0 0 0 .135-.0406 1.202 1.202 0 0 0 .1342.103c.5703.3765 1.5823.4213 3.0068.1344-.2016.1769-.5189.3994-.9533.6011-.4098.1903-1.0957.333-1.7473.3636-.7197.0336-1.0859-.0807-1.1721-.151zm.5695-9.2712c-.0059.3508-.0542.6692-.1054 1.0017-.055.3576-.112.7274-.1264 1.1762-.0142.4368.0404.8909.0932 1.3301.1066.887.216 1.8003-.2075 2.7014a3.5272 3.5272 0 0 1-.1876-.3856c-.0527-.1276-.1669-.3326-.3251-.6162-.6156-1.1041-2.0574-3.6896-1.3193-4.7446.3795-.5427 1.3408-.5661 2.1781-.463zm.2284 7.0137a12.3762 12.3762 0 0 0-.0853-.1074l-.0355-.0444c.7262-1.1995.5842-2.3862.4578-3.4385-.0519-.4318-.1009-.8396-.0885-1.2226.0129-.4061.0666-.7543.1185-1.0911.0639-.415.1288-.8443.1109-1.3505.0134-.0531.0188-.1158.0118-.1902-.0457-.4855-.5999-1.938-1.7294-3.253-.6076-.7073-1.4896-1.4972-2.6889-2.0395.5251-.1066 1.2328-.2035 2.0244-.1859 2.0515.0456 3.6746.8135 4.8242 2.2824a.908.908 0 0 1 .0667.1002c.7231 1.3556-.2762 6.2751-2.9867 10.5405zm-8.8166-6.1162c-.025.1794-.3089.4225-.6211.4225a.5821.5821 0 0 1-.0809-.0056c-.1873-.026-.3765-.144-.5059-.3156-.0458-.0605-.1203-.178-.1055-.2844.0055-.0401.0261-.0985.0925-.1488.1182-.0894.3518-.1226.6096-.0867.3163.0441.6426.1938.6113.4186zm7.9305-.4114c.0111.0792-.049.201-.1531.3102-.0683.0717-.212.1961-.4079.2232a.5456.5456 0 0 1-.075.0052c-.2935 0-.5414-.2344-.5607-.3717-.024-.1765.2641-.3106.5611-.352.297-.0414.6111.0088.6356.1851z" />
      </svg>
    ),
  },
  {
    name: "PGlite",
    icon: (
      <svg
        role="img"
        viewBox="48 48 240 176"
        xmlns="http://www.w3.org/2000/svg"
        className={styles.dbIcon}
        style={{ color: "#F6F95C" }}
      >
        <title>PGlite</title>
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M288 88.0507L288 215.97C288 220.391 284.413 223.975 279.991 223.97L247.968 223.932C243.734 223.927 240.272 220.634 239.995 216.471C239.998 216.313 240 216.155 240 215.996L239.999 167.998C239.999 154.744 229.239 143.999 215.984 143.999C203.138 143.999 192.636 133.906 192 121.217V48.0095L248.03 48.0507C270.109 48.0669 288 65.9708 288 88.0507ZM128 47.9983L128 104.023C128 117.277 138.745 128.023 152 128.023H176L176 126.414C176 144.962 191.036 159.998 209.584 159.998C217.533 159.998 223.977 166.442 223.977 174.391L223.977 215.932C223.977 216.123 223.98 216.313 223.984 216.503C223.722 220.685 220.247 223.996 215.999 223.996L175.726 223.994L176 168.034C176.022 163.616 172.457 160.017 168.039 159.995C163.621 159.973 160.022 163.538 160 167.956L159.726 223.959L159.726 223.992L111.9 223.989V167.995C111.9 163.577 108.318 159.995 103.9 159.995C99.4816 159.995 95.8999 163.577 95.8999 167.995V223.988L55.9995 223.986C51.5814 223.985 48 220.404 48 215.986V87.998C48 65.9066 65.9087 47.9979 88.0002 47.998L128 47.9983ZM252.04 96.2153C252.04 89.5879 246.667 84.2153 240.04 84.2153C233.412 84.2153 228.04 89.5879 228.04 96.2153C228.04 102.843 233.412 108.215 240.04 108.215C246.667 108.215 252.04 102.843 252.04 96.2153Z"
          fill="currentColor"
        />
      </svg>
    ),
  },
];

function SupportedDatabases() {
  return (
    <section className={styles.supportedDbSection}>
      <div className="container">
        <h2 className={styles.sectionTitle}>
          Built for the Postgres Ecosystem
        </h2>
        <p className={styles.heroSubtitle}>
          Fully validated and optimized for production use.
        </p>
        <div style={{ marginBottom: "4rem" }}>
          <div className={styles.dbGrid}>
            {dbList.map((db) => (
              <div key={db.name} className={styles.dbCard}>
                {db.icon}
                <span className={styles.dbName}>{db.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FeatureHighlights() {
  return (
    <section className={styles.featuresSection}>
      <div className="container">
        <div className={styles.featuresGrid}>
          <div className={styles.featureCard}>
            <div
              className={styles.featureIconWrapper}
              style={{ background: "rgba(255, 165, 0, 0.1)" }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={styles.featureIcon}
                style={{ color: "orange" }}
              >
                <polyline points="17 1 21 5 17 9"></polyline>
                <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
                <polyline points="7 23 3 19 7 15"></polyline>
                <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
              </svg>
            </div>
            <h3>Smart Migrations</h3>
            <p>
              Auto-generated, <strong>reversible</strong>, and{" "}
              <strong>squashable</strong> migrations. Roll back safely or
              consolidate history with a single command — production-ready
              schema management out of the box.
            </p>
          </div>
          <div className={styles.featureCard}>
            <div
              className={styles.featureIconWrapper}
              style={{ background: "rgba(65, 105, 225, 0.1)" }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 401 401"
                fill="none"
                className={styles.featureIcon}
                style={{ color: "royalblue" }}
              >
                <path
                  opacity="0.5"
                  d="M129.587 348.601L393.367 155.669L249.776 56.4025L0 248.835L129.587 348.601Z"
                  fill="currentColor"
                />
                <path
                  d="M400.999 155.669L262.155 352.029L129.586 348.601L194.887 259.076L259.699 261.218L339.565 146.666L262.637 84.7323L175.761 213.626L98.5303 154.673L211.536 0.17981L400.999 155.669Z"
                  fill="currentColor"
                />
              </svg>
            </div>
            <h3>Zod Validation</h3>
            <p>
              Runtime validation made easy. Durcno automatically generates{" "}
              <strong>Zod schemas</strong> inferred directly from your table
              definitions alongside strict TypeScript types.
            </p>
          </div>
          <div className={styles.featureCard}>
            <div
              className={styles.featureIconWrapper}
              style={{ background: "rgba(40, 180, 100, 0.1)" }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={styles.featureIcon}
                style={{ color: "rgb(40, 180, 100)" }}
              >
                <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
                <line x1="8" y1="2" x2="8" y2="18"></line>
                <line x1="16" y1="6" x2="16" y2="22"></line>
              </svg>
            </div>
            <h3>PostGIS Built-in</h3>
            <p>
              First-class support from day one. Use built-in{" "}
              <strong>geography</strong> columns with geojson date types and
              fully type-safe spatial operations & filters.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

const reviews = [
  {
    content: "Finally a query builder that doesn't get in your way. 🚀 @durcno",
  },
  {
    content:
      "Durcno's migration system is rock-solid. Auto generated, reversible and squashable migrations.",
  },
  {
    content:
      "Durcno is like PostgreSQL but type-safe. It's like using PostgreSQL on steroids.",
  },
];

function TwitterReviews() {
  return (
    <section className={styles.reviewsSection}>
      <div className="container">
        <h2 className={styles.sectionTitle}>Loved by Developers?</h2>
        <div className={styles.reviewsGrid}>
          {reviews.map((review) => (
            <div
              key={review.content}
              className={styles.reviewCard}
              style={{ display: "flex", flexDirection: "column" }}
            >
              <p className={styles.reviewContent}>"{review.content}"</p>
              <div
                style={{
                  marginTop: "auto",
                  paddingTop: "1.5rem",
                  textAlign: "right",
                }}
              >
                <Link
                  to={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                    review.content,
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontWeight: "bold",
                    fontSize: "0.9rem",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.4rem",
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  Tweet this
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Sponsors() {
  return (
    <section className={styles.sponsorsSection}>
      <div className="container">
        <h2 className={styles.sectionTitle}>Sponsors</h2>
        <p style={{ fontSize: "1.2rem", opacity: 0.7, marginBottom: "2rem" }}>
          Be the first to sponsor Durcno!
        </p>
        <div className={styles.sponsorsGrid}>
          <Link to="/sponsor" className={styles.sponsorPlaceholder}>
            + Your Logo Here
          </Link>
        </div>
      </div>
    </section>
  );
}
