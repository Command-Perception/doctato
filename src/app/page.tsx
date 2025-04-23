// app/page.tsx
import TutorialForm from "../components/tutorial-form";

export default function Home() {
  return (
    <main className="flex min-h-full flex-col items-center justify-start p-6 sm:p-12 md:p-24 bg-gradient-to-br from-gray-900 to-gray-800 dark:text-white">
       <div className="w-full max-w-4xl">
            <div className="text-center mb-8">
                <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-purple-400 to-blue-500 bg-clip-text text-transparent animate-gradient">doctato.</h1>
                 <h2 className="text-xl sm:text-2xl font-bold text-gray-300">AI Codebase Tutorial Generator</h2>
                 <p className="mt-2 text-sm sm:text-base text-gray-300">
                     Enter a GitHub repository URL or upload a local project zip to generate a beginner-friendly tutorial.
                 </p>
            </div>
            <TutorialForm />

             <footer className="mt-12 text-center text-xs text-gray-400">
                <span className="font-bold bg-gradient-to-r from-purple-400 to-blue-500 bg-clip-text text-transparent">vawx.ai</span> and <span className="font-bold bg-gradient-to-r from-purple-400 to-blue-500 bg-clip-text text-transparent">doctato</span>
                <div className="mt-1">Powered by AI - Based on the <a href="https://github.com/The-Pocket/Tutorial-Codebase-Knowledge" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Tutorial Codebase Knowledge</a> project.</div>
             </footer>
       </div>
    </main>
  );
}