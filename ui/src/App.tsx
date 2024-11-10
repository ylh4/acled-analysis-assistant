import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"

function App() {
  const [query, setQuery] = useState('');
  const [queryResponse, setQueryResponse] = useState<string | null>(null);
  const [isQuerying, setIsQuerying] = useState(false);

  const handleQuery = async () => {
    if (!query) return;
    
    setIsQuerying(true);
    try {
      console.log('Sending query:', query);

      const response = await fetch('http://localhost:3000/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: query }),
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`Query failed: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Response data:', data);
      
      if (data.success) {
        let responseText = data.answer || '';
        if (data.sql) {
          responseText += '\n\nSQL Query:\n' + data.sql;
        }
        setQueryResponse(responseText);
      } else {
        setQueryResponse(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Query error:', error);
      setQueryResponse(`Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
    } finally {
      setIsQuerying(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="flex gap-4 max-w-7xl mx-auto">
        {/* Left Column - Instructions */}
        <Card className="w-1/2">
          <CardHeader>
            <CardTitle>How to Query ACLED Data</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Available Columns (Include these in your questions):</h3>
              <ul className="list-disc pl-4 space-y-1 text-sm">
                <li><span className="font-mono">event_type</span>: Type of conflict event</li>
                <li><span className="font-mono">actor1</span>: Primary actor involved</li>
                <li><span className="font-mono">assoc_actor_1</span>: Actor associated with actor1</li>
                <li><span className="font-mono">actor2</span>: Secondary actor involved</li>
                <li><span className="font-mono">assoc_actor_2</span>: Actor associated with actor2</li>
                <li><span className="font-mono">region</span>: Geographic region</li>
                <li><span className="font-mono">country</span>: Country of event</li>
                <li><span className="font-mono">admin1</span>: First administrative division</li>
                <li><span className="font-mono">admin2</span>: Second administrative division</li>
                <li><span className="font-mono">admin3</span>: Third administrative division</li>
                <li><span className="font-mono">location</span>: Specific location</li>
                <li><span className="font-mono">latitude</span>: Geographic latitude</li>
                <li><span className="font-mono">longitude</span>: Geographic longitude</li>
                <li><span className="font-mono">fatalities</span>: Number of reported fatalities</li>
                <li><span className="font-mono">notes</span>: Additional event details</li>
                <li><span className="font-mono">source</span>: Information source</li>
                <li><span className="font-mono">tags</span>: Event tags</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Sample Questions:</h3>
              <ul className="list-disc pl-4 space-y-1 text-sm">
                <li>"Using the event_type column, what are the different types of events recorded?"</li>
                <li>"Using the country, region, and fatalities columns, what are the top 5 regions with the highest fatalities?"</li>
                <li>"Using the actor1, assoc_actor_1, and event_type columns, show events where military forces were involved as primary actors"</li>
                <li>"Using the location, latitude, and longitude columns, list all events in capital cities"</li>
                <li>"Using the admin1, admin2, and fatalities columns, which administrative regions had the most civilian casualties?"</li>
              </ul>
            </div>

            <div className="bg-muted p-4 rounded-md mt-4">
              <h3 className="font-semibold mb-2">Example of a Complex Query:</h3>
              <p className="text-sm">
                "Using the event_type, sub_event_type, actor1, region, country, and fatalities columns, show me the breakdown of violence types and casualties in East Africa where government forces were involved"
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Right Column - Query Interface */}
        <Card className="w-1/2">
          <CardHeader>
            <CardTitle>ACLED Data Query Interface</CardTitle>
          </CardHeader>
          <CardContent>
            <Label htmlFor="query">Ask about the Armed Conflict Location & Event Data (ACLED)</Label>
            <div className="flex gap-2">
              <input
                type="text"
                id="query"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 px-3 py-2 border rounded-md"
                placeholder="Ask a question about your data..."
              />
              <Button 
                onClick={handleQuery}
              >
                Ask
              </Button>
            </div>

            {isQuerying && (
              <div className="mt-4">
                <Skeleton className="h-20 w-full" />
              </div>
            )}

            {queryResponse && !isQuerying && (
              <div className="mt-4 p-4 bg-muted rounded-md">
                {queryResponse.split('\n').map((line, index) => (
                  <p key={index}>{line}</p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default App