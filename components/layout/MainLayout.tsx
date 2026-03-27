import Sidebar from './Sidebar'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-900">
      <Sidebar />
      <main className="flex-1 md:ml-64 p-6 overflow-auto">
        {children}
      </main>
    </div>
  )
}
