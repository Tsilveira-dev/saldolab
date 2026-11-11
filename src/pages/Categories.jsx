import { useFinance } from '../context/FinanceContext';
import { CategoryIcon, EmptyState, PageHeading, Panel, RowActions } from '../components/ui';
export default function Categories() {
  const { data, setEditor, remove } = useFinance();
  return (
    <>
      <PageHeading
        eyebrow="ORGANIZAÇÃO"
        title="Tudo no seu lugar."
        description="Categorias que fazem sentido para a sua vida financeira."
        action={() => setEditor({ entity: 'categories' })}
        label="Nova categoria"
      />
      <div className="categories-grid">
        {[
          ['expense', 'Despesas', 'Os destinos do seu dinheiro'],
          ['income', 'Receitas', 'As origens das suas conquistas'],
        ].map(([type, title, subtitle]) => (
          <Panel title={title} subtitle={subtitle} key={type}>
            <div className="category-list">
              {data.categories.filter((category) => category.type === type).length ? (
                data.categories
                  .filter((category) => category.type === type)
                  .map((category) => (
                    <div className="category-list-item" key={category.id}>
                      <CategoryIcon name={category.icon} color={category.color} />
                      <div>
                        <strong>{category.name}</strong>
                        <small>
                          {data.transactions.filter((tx) => tx.categoryId === category.id).length}{' '}
                          movimentações
                        </small>
                      </div>
                      <RowActions
                        name={category.name}
                        onEdit={() => setEditor({ entity: 'categories', row: category })}
                        onDelete={() => remove('categories', category)}
                      />
                    </div>
                  ))
              ) : (
                <EmptyState
                  title="Crie suas categorias"
                  description="Personalize nome, cor e ícone."
                  action={() => setEditor({ entity: 'categories' })}
                  label="Nova categoria"
                />
              )}
            </div>
          </Panel>
        ))}
      </div>
    </>
  );
}
