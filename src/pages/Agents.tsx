import React, { useState, useEffect, useMemo } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

// API base URL
const API_BASE_URL = 'http://127.0.0.1:3002';

// Interaction type definition
type Interaction = {
  id: string;
  user?: { name: string };
  timestamp: string;
  userPrompt: string;
  aiResponse: string;
  rating?: string;
  comments?: string[];
  function_name?: string;
  function_response?: string;
};

export default function Data() {
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterField, setFilterField] = useState<string>("");
  const [filterValue, setFilterValue] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("");
  const [sortDirection, setSortDirection] = useState<'asc'|'desc'>("asc");

  useEffect(() => {
    const fetchInteractions = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/interactions`);
        if (!res.ok) throw new Error('Failed to fetch interactions');
        const data = await res.json();
        setInteractions(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchInteractions();
  }, []);

  const processedData = useMemo(() => {
    let data = interactions;
    if (filterField && filterValue) {
      const val = filterValue.toLowerCase();
      data = data.filter(item => {
        switch (filterField) {
          case 'message': return item.userPrompt.toLowerCase().includes(val);
          case 'response': return item.aiResponse.toLowerCase().includes(val);
          case 'feedback': {
            const map: Record<string,string> = { Like: 'good', Dislike: 'bad', '-': '' };
            return item.rating === map[filterValue] || (!item.rating && filterValue === '-');
          }
          case 'comment': return item.comments?.some(c => c.toLowerCase().includes(val));
          case 'function_name': return item.function_name?.toLowerCase().includes(val);
          case 'function_response': return item.function_response?.toLowerCase().includes(val);
          case 'commentCount': return (item.comments?.length || 0) === Number(filterValue);
          case 'userId': return item.user?.name.toLowerCase().includes(val);
          case 'id': return item.id.toLowerCase().includes(val);
          case 'timestamp': return item.timestamp.toLowerCase().includes(val);
          default: return true;
        }
      });
    }
    if (sortBy) {
      data = [...data].sort((a, b) => {
        let va: any, vb: any;
        switch (sortBy) {
          case 'message': va = a.userPrompt; vb = b.userPrompt; break;
          case 'response': va = a.aiResponse; vb = b.aiResponse; break;
          case 'feedback': va = a.rating||''; vb = b.rating||''; break;
          case 'comment': va = a.comments?.join(' ')||''; vb = b.comments?.join(' ')||''; break;
          case 'commentCount': va = a.comments?.length||0; vb = b.comments?.length||0; break;
          case 'function_name': va = a.function_name||''; vb = b.function_name||''; break;
          case 'function_response': va = a.function_response||''; vb = b.function_response||''; break;
          case 'userId': va = a.user?.name||''; vb = b.user?.name||''; break;
          case 'id': va = a.id; vb = b.id; break;
          case 'timestamp': va = new Date(a.timestamp).getTime(); vb = new Date(b.timestamp).getTime(); break;
          default: va = ''; vb = ''; break;
        }
        if (typeof va === 'number' && typeof vb === 'number') {
          return sortDirection === 'asc' ? va - vb : vb - va;
        }
        return sortDirection === 'asc'
          ? String(va).localeCompare(String(vb))
          : String(vb).localeCompare(String(va));
      });
    }
    return data;
  }, [interactions, filterField, filterValue, sortBy, sortDirection]);

  const handleSort = (column: string) => {
    if (sortBy === column) setSortDirection(d => d==='asc'?'desc':'asc');
    else { setSortBy(column); setSortDirection('asc'); }
  };

  return (
    <div className="h-full">
      <Header title="Interactions" description="View user–assistant conversations">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium">Interactions</span>
        </div>
      </Header>
      
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Interaction Dashboard</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex space-x-2 items-center">
              <Select value={filterField} onValueChange={setFilterField}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Field" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="message">Message</SelectItem>
                  <SelectItem value="response">Response</SelectItem>
                  <SelectItem value="feedback">Feedback</SelectItem>
                  <SelectItem value="function_name">Function Name</SelectItem>
                  <SelectItem value="function_response">Function Response</SelectItem>
                  <SelectItem value="comment">Comment</SelectItem>
                  <SelectItem value="commentCount">Comment Count</SelectItem>
                  <SelectItem value="userId">User ID</SelectItem>
                  <SelectItem value="id">Message ID</SelectItem>
                  <SelectItem value="timestamp">Timestamp</SelectItem>
                </SelectContent>
              </Select>
              {filterField && (
                filterField === 'feedback' ? (
                  <Select value={filterValue} onValueChange={setFilterValue}>
                    <SelectTrigger className="w-40"><SelectValue placeholder="Value" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Like">Like</SelectItem>
                      <SelectItem value="Dislike">Dislike</SelectItem>
                      <SelectItem value="-">None</SelectItem>
                    </SelectContent>
                  </Select>
                ) : filterField === 'commentCount' ? (
                  <Input type="number" value={filterValue} onChange={e=>setFilterValue(e.target.value)} placeholder="Count" className="w-24" />
                ) : filterField === 'timestamp' ? (
                  <Input type="datetime-local" value={filterValue} onChange={e=>setFilterValue(e.target.value)} className="w-60" />
                ) : (
                  <Input value={filterValue} onChange={e=>setFilterValue(e.target.value)} placeholder="Value" className="w-1/3" />
                )
              )}
              <Button onClick={() => {}}>Apply</Button>
              <Button variant="outline" onClick={() => { setFilterField(''); setFilterValue(''); }} >Clear</Button>
            </div>
            <ScrollArea>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead><button onClick={()=>handleSort('message')} className="flex items-center">Message{sortBy==='message'?(sortDirection==='asc'?' ↑':' ↓'):''}</button></TableHead>
                    <TableHead><button onClick={()=>handleSort('response')} className="flex items-center">Response{sortBy==='response'?(sortDirection==='asc'?' ↑':' ↓'):''}</button></TableHead>
                    <TableHead><button onClick={()=>handleSort('feedback')} className="flex items-center">Feedback{sortBy==='feedback'?(sortDirection==='asc'?' ↑':' ↓'):''}</button></TableHead>
                    <TableHead><button onClick={()=>handleSort('function_name')} className="flex items-center">Function Name{sortBy==='function_name'?(sortDirection==='asc'?' ↑':' ↓'):''}</button></TableHead>
                    <TableHead><button onClick={()=>handleSort('function_response')} className="flex items-center">Function Response{sortBy==='function_response'?(sortDirection==='asc'?' ↑':' ↓'):''}</button></TableHead>
                    <TableHead><button onClick={()=>handleSort('comment')} className="flex items-center">Comment{sortBy==='comment'?(sortDirection==='asc'?' ↑':' ↓'):''}</button></TableHead>
                    <TableHead><button onClick={()=>handleSort('commentCount')} className="flex items-center">Comment Count{sortBy==='commentCount'?(sortDirection==='asc'?' ↑':' ↓'):''}</button></TableHead>
                    <TableHead><button onClick={()=>handleSort('userId')} className="flex items-center">User ID{sortBy==='userId'?(sortDirection==='asc'?' ↑':' ↓'):''}</button></TableHead>
                    <TableHead><button onClick={()=>handleSort('id')} className="flex items-center">Message ID{sortBy==='id'?(sortDirection==='asc'?' ↑':' ↓'):''}</button></TableHead>
                    <TableHead><button onClick={()=>handleSort('timestamp')} className="flex items-center">Timestamp{sortBy==='timestamp'?(sortDirection==='asc'?' ↑':' ↓'):''}</button></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8}>Loading...</TableCell>
                    </TableRow>
                  ) : error ? (
                    <TableRow>
                      <TableCell colSpan={8}>{error}</TableCell>
                    </TableRow>
                  ) : (
                    processedData.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          {item.userPrompt.length > 50 ? (
                            <Popover>
                              <PopoverTrigger asChild>
                                <button className="text-left w-full truncate">{`${item.userPrompt.slice(0,50)}...`}</button>
                              </PopoverTrigger>
                              <PopoverContent className="w-64 whitespace-pre-wrap">
                                {item.userPrompt}
                              </PopoverContent>
                            </Popover>
                          ) : (
                            item.userPrompt
                          )}
                        </TableCell>
                        <TableCell>
                          {item.aiResponse.length > 50 ? (
                            <Popover>
                              <PopoverTrigger asChild>
                                <button className="text-left w-full truncate">{`${item.aiResponse.slice(0,50)}...`}</button>
                              </PopoverTrigger>
                              <PopoverContent className="w-64 whitespace-pre-wrap">
                                {item.aiResponse}
                              </PopoverContent>
                            </Popover>
                          ) : (
                            item.aiResponse
                          )}
                        </TableCell>
                        <TableCell>{item.rating === 'good' ? 'Like' : item.rating === 'bad' ? 'Dislike' : item.rating || '-'}</TableCell>
                        <TableCell>
                          {item.function_name ? (
                            item.function_name.length > 50 ? (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button className="text-left w-full truncate">{`${item.function_name.slice(0,50)}...`}</button>
                                </PopoverTrigger>
                                <PopoverContent className="w-64 whitespace-pre-wrap">
                                  {item.function_name}
                                </PopoverContent>
                              </Popover>
                            ) : (
                              item.function_name
                            )
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          {item.function_response ? (
                            item.function_response.length > 50 ? (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button className="text-left w-full truncate">{`${item.function_response.slice(0,50)}...`}</button>
                                </PopoverTrigger>
                                <PopoverContent className="w-64 whitespace-pre-wrap">
                                  {item.function_response}
                                </PopoverContent>
                              </Popover>
                            ) : (
                              item.function_response
                            )
                          ) : '-'}
                        </TableCell>
                        <TableCell>{item.comments && item.comments.length > 0 ? item.comments.join(', ') : '-'}</TableCell>
                        <TableCell>{item.comments ? item.comments.length : 0}</TableCell>
                        <TableCell>{item.user?.name || 'N/A'}</TableCell>
                        <TableCell>{item.id}</TableCell>
                        <TableCell>{item.timestamp && new Date(item.timestamp).toLocaleString()}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
