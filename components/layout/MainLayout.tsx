import Sidebar from './Sidebar'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-900">
      <Sidebar />
      <main className="flex-1 min-w-0 p-4 md:p-6 overflow-auto">
        {children}
      </main>
    </div>
  )
}
