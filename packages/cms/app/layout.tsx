import config from '@payload-config';
import { handleServerFunctions, RootLayout as PayloadRootLayout } from '@payloadcms/next/layouts';
import type { Metadata } from 'next';
import type { ServerFunctionClient } from 'payload';

import { importMap } from './(payload)/admin/importMap';

import '@payloadcms/next/css';
import './style.css';

export const metadata: Metadata = {
  title: 'Mui简历 CMS',
  description: 'Mui简历内容后台。',
};

const serverFunction: ServerFunctionClient = async (args) => {
  'use server';

  return handleServerFunctions({
    ...args,
    config,
    importMap,
  });
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <PayloadRootLayout
      config={config}
      htmlProps={{ lang: 'zh-CN' }}
      importMap={importMap}
      serverFunction={serverFunction}
    >
      {children}
    </PayloadRootLayout>
  );
}
