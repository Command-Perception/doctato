// app/page.tsx
import TutorialForm from "../components/tutorial-form";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-start p-6 sm:p-12 md:p-24 bg-gradient-to-br from-gray-50 to-blue-50">
       <div className="w-full max-w-4xl">
            <div className="text-center mb-8">
                <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">doctato.</h1>
                 <h2 className="text-xl sm:text-4xl font-bold text-gray-600">AI Codebase Tutorial Generator</h2>
                 <p className="mt-2 text-sm sm:text-base text-gray-600">
                     Enter a GitHub repository URL or upload a local project zip to generate a beginner-friendly tutorial.
                 </p>
            </div>
            <TutorialForm />

             <footer className="mt-12 text-center text-xs text-gray-500">
                Powered by AI - Based on the <a href="https://github.com/The-Pocket/Tutorial-Codebase-Knowledge" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Tutorial Codebase Knowledge</a> project.
             </footer>
       </div>
    </main>
  );
}