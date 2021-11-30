import * as React from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import { ReactElement } from 'react';

export default function CardComponent({ children }: { children?: ReactElement | ReactElement[] }) {
	return (
		<Box sx={{ minWidth: 275 }}>
			<Card variant="outlined">{children}</Card>
		</Box>
	);
}
