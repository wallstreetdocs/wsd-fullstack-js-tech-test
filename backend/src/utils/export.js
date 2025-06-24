import { Parser } from 'json2csv';

export function generateCsv(tasks) {
  const fields = [
    'title',
    'description',
    'status',
    'priority',
    'dueDate',
    'createdAt',
    'updatedAt'
  ];

  const parser = new Parser({ fields });
  return parser.parse(tasks);
}

export function generateJson(tasks) {
  return JSON.stringify(tasks, null, 2);
}
