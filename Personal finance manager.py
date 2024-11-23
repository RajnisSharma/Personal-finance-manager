# Personal Finance Manger Project:-
import tkinter as tk
from tkinter import ttk
import datetime
from tkinter import messagebox

class RoundedButton(tk.Canvas):
    def __init__(self, parent, text, command, **kwargs):
        tk.Canvas.__init__(self, parent, **kwargs)
        self.command = command
        self.text = text
        self.create_rounded_rectangle(0, 0, kwargs.get("width", 100), kwargs.get("height", 40), radius=30, fill="red", outline="")
        self.create_text(kwargs.get("width", 100) // 2, kwargs.get("height", 40) // 2, text=text, fill="white")
        self.bind("<Button-1>", self.on_click)

    def create_rounded_rectangle(self, x1, y1, x2, y2, radius=25, **kwargs):
        points = [x1+radius, y1,
                  x1+radius, y1,
                  x2-radius, y1,
                  x2-radius, y1,
                  x2, y1,
                  x2, y1+radius,
                  x2, y1+radius,
                  x2, y2-radius,
                  x2, y2-radius,
                  x2, y2,
                  x2-radius, y2,
                  x2-radius, y2,
                  x1+radius, y2,
                  x1+radius, y2,
                  x1, y2,
                  x1, y2-radius,
                  x1, y2-radius,
                  x1, y1+radius,
                  x1, y1+radius,
                  x1, y1]

        return self.create_polygon(points, **kwargs, smooth=True)

    def on_click(self, event):
        self.command()

class FinanceManagerApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Personal Finance Manager")
        self.root.configure(bg="blue")
        self.transactions = []

        # Set up the style
        self.style = ttk.Style()
        self.style.configure("TFrame", padding=9, background="magenta")
        self.style.configure("TLabel", padding=9, background="lightgreen")
        self.style.configure("TEntry", padding=9, background="white")
        self.style.configure("TButton", padding=9, background="lightgreen")
        self.style.configure("TCombobox", padding=9, background="white")
        self.style.configure("TTreeview", padding=9, background="white")
        self.style.configure("Treeview.Heading", padding=9, background="lightgreen")

        # Set up the UI
        self.create_widgets()

    def create_widgets(self):
        # Header
        header_label = ttk.Label(self.root, text="Personal Finance Manager", font=("Helvetica", 16))
        header_label.pack(pady=9, padx=9)  # Padding around the header label

        # Transaction Details
        self.amount_var = tk.DoubleVar()
        self.desc_var = tk.StringVar()
        self.type_var = tk.StringVar(value="Income")

        form_frame = ttk.Frame(self.root)
        form_frame.pack(pady=9, padx=9)  # Padding around the frame

        ttk.Label(form_frame, text="Amount:").grid(row=0, column=0, sticky=tk.W, pady=9, padx=9)
        ttk.Entry(form_frame, textvariable=self.amount_var).grid(row=0, column=1, pady=9, padx=9)

        ttk.Label(form_frame, text="Description:").grid(row=1, column=0, sticky=tk.W, pady=9, padx=9)
        ttk.Entry(form_frame, textvariable=self.desc_var).grid(row=1, column=1, pady=9, padx=9)

        ttk.Label(form_frame, text="Type:").grid(row=2, column=0, sticky=tk.W, pady=9, padx=9)
        ttk.Combobox(form_frame, textvariable=self.type_var, values=["Income", "Expense"]).grid(row=2, column=1, pady=9, padx=9)

        add_transaction_button = RoundedButton(form_frame, text="Add Transaction", command=self.add_transaction, width=100, height=30)
        add_transaction_button.grid(row=3, columnspan=2, pady=9, padx=9)

        # Transaction History
        self.tree = ttk.Treeview(self.root, columns=("Date", "Description", "Amount", "Type"), show='headings')
        self.tree.heading("Date", text="Date")
        self.tree.heading("Description", text="Description")
        self.tree.heading("Amount", text="Amount")
        self.tree.heading("Type", text="Type")
        self.tree.pack(pady=9, padx=9)  # Padding around the Treeview

        # Balance
        self.balance_label = ttk.Label(self.root, text="Current Balance: $0.00", font=("Helvetica", 14))
        self.balance_label.pack(pady=9, padx=9)  # Padding around the balance label

    def add_transaction(self):
        amount = self.amount_var.get()
        description = self.desc_var.get()
        type_ = self.type_var.get()
        date = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        if amount <= 0 or not description:
            messagebox.showerror("Error", "Please enter valid transaction details")
            return

        transaction = {"date": date, "description": description, "amount": amount, "type": type_}
        self.transactions.append(transaction)
        self.update_transaction_history()
        self.update_balance()

        # Clear the input fields
        self.amount_var.set(0)
        self.desc_var.set("")
        self.type_var.set("Income")

    def update_transaction_history(self):
        for row in self.tree.get_children():
            self.tree.delete(row)

        for transaction in self.transactions:
            self.tree.insert("", "end", values=(transaction["date"], transaction["description"], transaction["amount"], transaction["type"]))

    def update_balance(self):
        income = sum(t["amount"] for t in self.transactions if t["type"] == "Income")
        expenses = sum(t["amount"] for t in self.transactions if t["type"] == "Expense")
        balance = income - expenses
        self.balance_label.config(text=f"Current Balance: ${balance:.2f}")


if __name__ == "__main__":
    root = tk.Tk()
    app = FinanceManagerApp(root)
    root.mainloop()
