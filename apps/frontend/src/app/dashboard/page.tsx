import { redirect } from "next/navigation";
import { Users, Code, CheckCheck, BarChart3, ExternalLink } from "lucide-react";

import { UserProfile } from "@lib/types";
import { createClient } from "@lib/supabase/server";

const stats = [
  {
    title: "Total Users",
    value: "1,254",
    icon: Users,
    change: "+12% this month",
    color: "text-blue-500",
  },
  {
    title: "Total Submissions",
    value: "8,432",
    icon: Code,
    change: "+8% this month",
    color: "text-purple-500",
  },
  {
    title: "Accepted Rate",
    value: "68.2%",
    icon: CheckCheck,
    change: "-1.2% this month",
    color: "text-green-500",
  },
  {
    title: "Avg. Score",
    value: "85/100",
    icon: BarChart3,
    change: "+2.5 this month",
    color: "text-orange-500",
  },
];

const recentSubmissions = [
  {
    id: "1",
    user: "Chanwoo Song",
    email: "chanwoo@example.com",
    problem: "Two Sum",
    status: "Accepted",
  },
  {
    id: "2",
    user: "Alex Johnson",
    email: "alex@example.com",
    problem: "Reverse String",
    status: "Wrong Answer",
  },
  {
    id: "3",
    user: "Maria Garcia",
    email: "maria@example.com",
    problem: "Median of Two Sorted Arrays",
    status: "Accepted",
  },
  {
    id: "4",
    user: "Ken Tanaka",
    email: "ken@example.com",
    problem: "Longest Substring Without Repeating Characters",
    status: "Time Limit Exceeded",
  },
];

const submissionChartData = [
  { name: "Mon", value: 20 },
  { name: "Tue", value: 45 },
  { name: "Wed", value: 60 },
  { name: "Thu", value: 30 },
  { name: "Fri", value: 75 },
  { name: "Sat", value: 90 },
  { name: "Sun", value: 50 },
];

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<UserProfile>();

  if (!profile?.is_admin) {
    return redirect("/");
  }

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900/50 text-gray-900 dark:text-gray-100">
      <main className="flex-1 p-4 sm:p-6 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Admin Dashboard
          </h1>

          {/* Stat Cards */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <div
                key={stat.title}
                className="bg-white dark:bg-gray-800/50 rounded-xl shadow-md overflow-hidden transition-transform hover:scale-105 duration-300"
              >
                <div className="p-5">
                  <div className="flex items-center">
                    <div
                      className={`flex-shrink-0 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg ${stat.color}`}
                    >
                      <stat.icon className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                          {stat.title}
                        </dt>
                        <dd className="flex items-baseline">
                          <span className="text-2xl font-semibold">
                            {stat.value}
                          </span>
                        </dd>
                      </dl>
                    </div>
                  </div>
                  <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                    {stat.change}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Submission Chart */}
            <div className="lg:col-span-2 bg-white dark:bg-gray-800/50 rounded-xl shadow-md p-6">
              <h3 className="font-semibold text-lg mb-4">Weekly Submissions</h3>
              <div className="flex items-end justify-around h-64 w-full space-x-2">
                {submissionChartData.map((data) => (
                  <div
                    key={data.name}
                    className="flex flex-col items-center space-y-2 w-full"
                  >
                    <div
                      className="w-full bg-blue-400 dark:bg-blue-500 rounded-t-lg transition-all duration-300 hover:bg-blue-500 dark:hover:bg-blue-400"
                      style={{ height: `${(data.value / 100) * 100}%` }}
                    ></div>
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      {data.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Submissions */}
            <div className="bg-white dark:bg-gray-800/50 rounded-xl shadow-md p-6">
              <h3 className="font-semibold text-lg mb-4">Recent Submissions</h3>
              <ul className="space-y-4">
                {recentSubmissions.map((submission) => (
                  <li
                    key={submission.id}
                    className="flex items-center space-x-3"
                  >
                    <div
                      className={`flex-shrink-0 p-2 rounded-full ${submission.status === "Accepted" ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"}`}
                    >
                      {submission.status === "Accepted" ? (
                        <CheckCheck className="h-5 w-5" />
                      ) : (
                        <Code className="h-5 w-5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {submission.problem}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        by {submission.user}
                      </p>
                    </div>
                    <a
                      href="#"
                      className="text-sm text-blue-500 hover:underline"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
